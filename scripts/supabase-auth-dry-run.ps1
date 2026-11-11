# Dry-run only. Never applies migrations or repairs history.
# Output monitoring cannot undo server activity that precedes a log message.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$cli = 'C:\Users\DELL\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$ca = 'C:\Users\DELL\BabulLearnBackups\slo-ai\certs\supabase-ca.crt'
$expectedMigrationHash = '437DD4C34892252B745F1D29A47864C67F0CD7C333BBCE005503E6687F585FBE'
$expectedCaHash = '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7'

if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) {
    throw 'Reviewed CLI executable not found. No connection attempted.'
}
# Capture native streams separately: Windows PowerShell can turn redirected
# stderr notices into terminating errors when ErrorActionPreference is Stop.
$versionInfo = New-Object System.Diagnostics.ProcessStartInfo
$versionInfo.FileName = $cli
$versionInfo.Arguments = '--version'
$versionInfo.UseShellExecute = $false
$versionInfo.CreateNoWindow = $true
$versionInfo.RedirectStandardOutput = $true
$versionInfo.RedirectStandardError = $true
$versionProcess = New-Object System.Diagnostics.Process
$versionProcess.StartInfo = $versionInfo
try {
    if (-not $versionProcess.Start()) {
        throw 'CLI version check failed to start. No connection attempted.'
    }
    $versionStdout = $versionProcess.StandardOutput.ReadToEndAsync()
    $versionStderr = $versionProcess.StandardError.ReadToEndAsync()
    if (-not $versionProcess.WaitForExit(30000)) {
        throw 'CLI version check timed out. No connection attempted.'
    }
    $versionOutput = $versionStdout.GetAwaiter().GetResult().Trim()
    # Drain notices without treating them as errors or trusting them as a version.
    [void]$versionStderr.GetAwaiter().GetResult()
    if ($versionProcess.ExitCode -ne 0 -or $versionOutput -cne '2.122.0') {
        throw 'Expected Supabase CLI 2.122.0. No connection attempted.'
    }
}
finally {
    try {
        if (-not $versionProcess.HasExited) {
            $versionProcess.Kill()
            $versionProcess.WaitForExit()
        }
    }
    finally { $versionProcess.Dispose() }
}

$linkPath = Join-Path $projectRoot 'supabase\.temp\linked-project.json'
$link = Get-Content -Raw -LiteralPath $linkPath | ConvertFrom-Json
if ($link.ref -ne 'fltaxhryfwthjlvltffr') {
    throw 'Linked project mismatch. No connection attempted.'
}
$migrations = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'supabase\migrations') -File)
if ($migrations.Count -ne 1 -or
    $migrations[0].Name -ne '20261104000100_auth_profiles.sql') {
    throw 'Unexpected migration file set. No connection attempted.'
}
if ((Get-FileHash -LiteralPath $migrations[0].FullName -Algorithm SHA256).Hash -ne $expectedMigrationHash) {
    throw 'Migration checksum mismatch. No connection attempted.'
}
if ((Get-FileHash -LiteralPath $ca -Algorithm SHA256).Hash -ne $expectedCaHash) {
    throw 'CA certificate checksum mismatch. No connection attempted.'
}

Write-Host 'Verified CLI 2.122.0, project fltaxhryfwthjlvltffr, migration and CA hashes.'
Write-Host 'Command: db push --linked --skip-vault --dry-run'
Write-Warning 'Dry-run skips migration application. Output monitoring cannot guarantee zero initialization side effects.'
$secret = Read-Host 'Supabase database password' -AsSecureString
$pointer = [IntPtr]::Zero
$plainPassword = $null
$process = $null
$startInfo = $null
$completed = $false

try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($plainPassword)) {
        throw 'Empty password. No connection attempted.'
    }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $cli
    $startInfo.Arguments = 'db push --linked --skip-vault --dry-run'
    $startInfo.WorkingDirectory = $projectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.EnvironmentVariables['SUPABASE_DB_PASSWORD'] = $plainPassword
    $startInfo.EnvironmentVariables['PGSSLMODE'] = 'verify-full'
    $startInfo.EnvironmentVariables['PGSSLROOTCERT'] = $ca
    # Defense in depth, not a guarantee: poolers may not preserve startup options.
    $startInfo.EnvironmentVariables['PGOPTIONS'] = '-c default_transaction_read_only=on'
    $startInfo.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '15'
    # Never inherit unattended approval or debug logging.
    $startInfo.EnvironmentVariables.Remove('SUPABASE_YES')
    $startInfo.EnvironmentVariables.Remove('SUPABASE_DEBUG')

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw 'CLI failed to start.' }
    $process.StandardInput.Close()

    $readers = @($process.StandardOutput, $process.StandardError)
    $pending = @($readers[0].ReadLineAsync(), $readers[1].ReadLineAsync())
    $open = @($true, $true)
    $timer = [Diagnostics.Stopwatch]::StartNew()

    while ($open[0] -or $open[1]) {
        if ($timer.Elapsed.TotalSeconds -gt 120) {
            throw 'Dry-run exceeded 120 seconds. Stopping; no retry.'
        }
        foreach ($i in 0, 1) {
            if (-not $open[$i] -or -not $pending[$i].IsCompleted) { continue }
            $line = $pending[$i].GetAwaiter().GetResult()
            if ($null -eq $line) { $open[$i] = $false; continue }

            $cleanLine = [regex]::Replace($line, '\x1B\[[0-?]*[ -/]*[@-~]', '')
            $safeLine = $cleanLine.Replace($plainPassword, '[REDACTED]')
            $safeLine = [regex]::Replace($safeLine, '(?i)postgres(?:ql)?://\S+', '[REDACTED CONNECTION URI]')
            Write-Host $safeLine

            $unexpected = $cleanLine -match '(?i)initiali[sz]|migration.?history.*repair|repair.*migration|applying migration|creating.*(?:role|schema|table)|updating.*vault|seeding|do you want to push'
            if ($unexpected -and $cleanLine -notmatch '(?i)^\s*(would|dry.run).*') {
                throw 'Unexpected initialization/write/prompt detected. Stopping; inspect production read-only before proceeding.'
            }
            $pending[$i] = $readers[$i].ReadLineAsync()
        }
        [Threading.Thread]::Sleep(20)
    }

    if (-not $process.WaitForExit(5000)) {
        throw 'CLI did not exit after closing output. Stopping.'
    }
    if ($process.ExitCode -ne 0) {
        throw "Dry-run failed with exit code $($process.ExitCode). No retry."
    }
    $completed = $true
    Write-Host 'Dry-run exit code: 0. Review output: only migration 20261104000100 should be pending.'
}
finally {
    if ($null -ne $process) {
        try {
            if (-not $process.HasExited) {
                $process.Kill()
                $process.WaitForExit()
            }
        } finally { $process.Dispose() }
    }
    if ($null -ne $startInfo) {
        $startInfo.EnvironmentVariables.Remove('SUPABASE_DB_PASSWORD')
    }
    $plainPassword = $null
    if ($pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secret.Dispose()
}
