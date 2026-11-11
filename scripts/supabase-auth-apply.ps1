# Production execution: only the reviewed authentication migration.
# Monitoring is reactive; a server action can precede its output message.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-AuthPushLineKind {
    param([string]$Line)
    $text = ([regex]::Replace($Line, '\x1B\[[0-?]*[ -/]*[@-~]', '')).Trim()
    if ($text -eq '') { return 'blank' }
    if ($text -match '(?i)initiali[sz].*login|repair|reset|seeding|updating.*vault|\bERROR\b|\bFATAL\b') {
        return 'reject'
    }
    if ($text -match '\b\d{14}[^\s]*\.sql\b' -and
        $text -notmatch '20261104000100_auth_profiles\.sql') { return 'reject' }
    if ($text -match '^Applying migration 20261104000100_auth_profiles\.sql\.{0,3}$') { return 'apply' }
    if ($text -match '^Finished supabase db push\.?$') { return 'finished' }
    if ($text -match '^Do you want to push these migrations to the remote database\?\s*(\[Y/n\])?$') { return 'prompt' }
    if ($text -eq '[Y/n]') { return 'choice' }
    if ($text -match '^[^\w]*20261104000100_auth_profiles\.sql\s*$') { return 'migration' }
    if ($text -match '^Connecting to remote database\.{0,3}$') { return 'info' }
    # Known update notices do not change the pinned executable.
    if ($text -match '^A new version of Supabase CLI is available:' -or
        $text -match '^We recommend updating regularly for new features and bug fixes:' -or
        $text -eq 'https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli') { return 'info' }
    # Existing tracking objects may emit notices, but never repair history.
    if ($text -match '^NOTICE \(42P06\): schema "supabase_migrations" already exists, skipping$' -or
        $text -match '^NOTICE \(42P07\): relation "(schema_migrations|seed_files)" already exists, skipping$') { return 'info' }
    return 'reject'
}

function Assert-AuthPushFiles {
    $linked = Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'supabase\.temp\linked-project.json') | ConvertFrom-Json
    if ($linked.ref -ne 'fltaxhryfwthjlvltffr') { throw 'Linked project mismatch.' }
    $files = @(Get-ChildItem -LiteralPath (Join-Path $projectRoot 'supabase\migrations') -File)
    if ($files.Count -ne 1 -or $files[0].Name -ne '20261104000100_auth_profiles.sql') {
        throw 'Unexpected migration set.'
    }
    if ((Get-FileHash -LiteralPath $files[0].FullName -Algorithm SHA256).Hash -ne
        '437DD4C34892252B745F1D29A47864C67F0CD7C333BBCE005503E6687F585FBE') {
        throw 'Migration checksum mismatch.'
    }
    if ((Get-FileHash -LiteralPath $ca -Algorithm SHA256).Hash -ne
        '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
        throw 'CA checksum mismatch.'
    }
    $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($ca)
    try {
        if ((Get-Date) -lt $certificate.NotBefore -or (Get-Date) -gt $certificate.NotAfter) {
            throw 'CA certificate is outside its validity period.'
        }
    } finally { $certificate.Dispose() }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$cli = 'C:\Users\DELL\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$ca = 'C:\Users\DELL\BabulLearnBackups\slo-ai\certs\supabase-ca.crt'
if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) { throw 'Reviewed CLI not found.' }

# Separate native streams so harmless stderr update notices cannot terminate
# Windows PowerShell's version check. Only stdout determines the version.
$versionInfo = New-Object Diagnostics.ProcessStartInfo
$versionInfo.FileName = $cli
$versionInfo.Arguments = '--version'
$versionInfo.UseShellExecute = $false
$versionInfo.CreateNoWindow = $true
$versionInfo.RedirectStandardOutput = $true
$versionInfo.RedirectStandardError = $true
$versionProcess = New-Object Diagnostics.Process
$versionProcess.StartInfo = $versionInfo
try {
    if (-not $versionProcess.Start()) { throw 'Version check failed to start.' }
    $stdout = $versionProcess.StandardOutput.ReadToEndAsync()
    $stderr = $versionProcess.StandardError.ReadToEndAsync()
    if (-not $versionProcess.WaitForExit(30000)) { throw 'Version check timed out.' }
    $version = $stdout.GetAwaiter().GetResult().Trim()
    [void]$stderr.GetAwaiter().GetResult()
    if ($versionProcess.ExitCode -ne 0 -or $version -cne '2.122.0') {
        throw 'Expected exactly Supabase CLI 2.122.0.'
    }
} finally {
    try {
        if (-not $versionProcess.HasExited) { $versionProcess.Kill(); $versionProcess.WaitForExit() }
    } finally { $versionProcess.Dispose() }
}

Assert-AuthPushFiles
Write-Host 'Target: production project fltaxhryfwthjlvltffr'
Write-Host 'Only migration: 20261104000100_auth_profiles.sql'
Write-Host 'Command: db push --linked --skip-vault'
Write-Warning 'This changes production schema and signup behavior. Output monitoring cannot undo completed server actions.'
$approval = Read-Host 'Type APPLY fltaxhryfwthjlvltffr 20261104000100 to continue'
if ($approval -cne 'APPLY fltaxhryfwthjlvltffr 20261104000100') {
    throw 'Confirmation did not match. No database connection attempted.'
}
$secret = Read-Host 'Database password (hidden; never written to disk)' -AsSecureString
$pointer = [IntPtr]::Zero
$plainPassword = $null
$process = $null
$startInfo = $null
$started = $false
try {
    Assert-AuthPushFiles
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw 'Empty password.' }

    $startInfo = New-Object Diagnostics.ProcessStartInfo
    $startInfo.FileName = $cli
    $startInfo.Arguments = 'db push --linked --skip-vault'
    $startInfo.WorkingDirectory = $projectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.EnvironmentVariables['SUPABASE_DB_PASSWORD'] = $plainPassword
    $startInfo.EnvironmentVariables['PGSSLMODE'] = 'verify-full'
    $startInfo.EnvironmentVariables['PGSSLROOTCERT'] = $ca
    $startInfo.EnvironmentVariables['PGCONNECT_TIMEOUT'] = '15'
    # Apply must not inherit the dry-run's read-only startup option, a service
    # file, or unattended approval/debug options.
    foreach ($name in @('PGOPTIONS','PGSERVICE','PGSERVICEFILE','SUPABASE_YES','SUPABASE_DEBUG')) {
        $startInfo.EnvironmentVariables.Remove($name)
    }

    $process = New-Object Diagnostics.Process
    $process.StartInfo = $startInfo
    $started = $process.Start()
    if (-not $started) { throw 'CLI failed to start.' }

    # Read characters, not lines: the CLI confirmation can lack a newline.
    $readers = @($process.StandardOutput, $process.StandardError)
    $buffers = @([char[]]::new(1), [char[]]::new(1))
    $pending = @($readers[0].ReadAsync($buffers[0], 0, 1), $readers[1].ReadAsync($buffers[1], 0, 1))
    $open = @($true, $true)
    $lines = @('', '')
    $listed = $false
    $confirmed = $false
    $promptSeen = $false
    $applying = $false
    $finished = $false
    $timer = [Diagnostics.Stopwatch]::StartNew()

    while ($open[0] -or $open[1]) {
        if ($timer.Elapsed.TotalMinutes -gt 10) { throw 'Execution timeout. Stop; inspect production read-only. No retry.' }
        foreach ($i in 0, 1) {
            if (-not $open[$i] -or -not $pending[$i].IsCompleted) { continue }
            $count = $pending[$i].GetAwaiter().GetResult()
            $flush = $count -eq 0
            if ($count -gt 0) {
                $ch = $buffers[$i][0]
                if ($ch -eq [char]10 -or $ch -eq [char]13) { $flush = $true }
                else { $lines[$i] += $ch }
            }
            $clean = ([regex]::Replace($lines[$i], '\x1B\[[0-?]*[ -/]*[@-~]', '')).Trim()
            if ($clean -match '\[Y/n\]$') { $flush = $true }
            if ($lines[$i].Length -gt 16384) { throw 'Unexpected oversized CLI output. Stopping.' }

            if ($flush -and $clean -ne '') {
                $kind = Get-AuthPushLineKind $clean
                # Do not print unrecognized output: it could contain credentials.
                if ($kind -eq 'reject') {
                    throw 'Unexpected CLI output detected and withheld. Process stopped; inspect production read-only before any further action.'
                }
                if ($kind -eq 'migration') { $listed = $true }
                if ($kind -eq 'prompt') { $promptSeen = $true }
                if ($kind -eq 'choice' -or ($kind -eq 'prompt' -and $clean -match '\[Y/n\]$')) {
                    if (-not $listed -or -not $promptSeen -or $confirmed) { throw 'Unexpected confirmation sequence.' }
                    Write-Host $clean
                    $answer = Read-Host 'Type y to approve the CLI confirmation; anything else cancels'
                    if ($answer -cne 'y') { throw 'CLI confirmation cancelled.' }
                    Assert-AuthPushFiles
                    $process.StandardInput.WriteLine('y')
                    $process.StandardInput.Flush()
                    $confirmed = $true
                    $timer.Restart()
                } elseif ($kind -eq 'apply') {
                    if (-not $listed -or -not $confirmed -or $applying) { throw 'Unexpected migration application sequence.' }
                    $applying = $true
                    Write-Host $clean
                } elseif ($kind -eq 'finished') {
                    if (-not $applying) { throw 'No reviewed migration application observed.' }
                    $finished = $true
                    Write-Host $clean
                } elseif ($kind -ne 'prompt') {
                    Write-Host ($clean.Replace($plainPassword, '[REDACTED]'))
                }
                $lines[$i] = ''
            } elseif ($flush) { $lines[$i] = '' }

            if ($count -eq 0) { $open[$i] = $false }
            else { $pending[$i] = $readers[$i].ReadAsync($buffers[$i], 0, 1) }
        }
        [Threading.Thread]::Sleep(20)
    }
    if (-not $process.WaitForExit(5000)) { throw 'CLI did not exit.' }
    if ($process.ExitCode -ne 0) { throw "CLI failed with exit code $($process.ExitCode). No retry." }
    if (-not $finished) { throw 'Expected completion was not observed. Inspect production read-only; do not rerun.' }
    Write-Host 'Production push exit code: 0. Run the read-only post-apply SQL checks next.'
} finally {
    if ($null -ne $process) {
        try {
            if ($started -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
        } finally { $process.Dispose() }
    }
    if ($null -ne $startInfo) { $startInfo.EnvironmentVariables.Remove('SUPABASE_DB_PASSWORD') }
    $plainPassword = $null
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $secret.Dispose()
}
