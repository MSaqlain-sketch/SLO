# Run manually in an interactive terminal. This script changes production only
# after explicit approval and the CLI's own independent confirmation.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-BabulInteractiveTerminal {
    if (-not [Environment]::UserInteractive -or
        [Console]::IsInputRedirected -or
        [Console]::IsOutputRedirected -or
        [Console]::IsErrorRedirected -or
        $Host.Name -ne 'ConsoleHost') {
        throw 'Run manually in an interactive PowerShell terminal without pipes or redirection.'
    }
}

function Assert-BabulCliVersion {
    param([string]$Cli)
    if (-not (Test-Path -LiteralPath $Cli -PathType Leaf)) { throw 'Reviewed CLI executable not found.' }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Cli
    $info.Arguments = '--version'
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    $started = $false
    try {
        $started = $process.Start()
        if (-not $started) { throw 'CLI version check failed to start.' }
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(30000)) { throw 'CLI version check timed out.' }
        $version = $stdout.GetAwaiter().GetResult().Trim()
        [void]$stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0 -or $version -cne '2.122.0') {
            throw 'Expected exactly Supabase CLI 2.122.0. Nothing will be applied.'
        }
    }
    finally {
        try {
            if ($started -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
        }
        finally { $process.Dispose() }
    }
}

function Assert-BabulMigrationFiles {
    param([string]$Root, [string]$Ca)
    $link = Get-Content -Raw -LiteralPath (Join-Path $Root 'supabase\.temp\linked-project.json') | ConvertFrom-Json
    if ($link.ref -cne 'fltaxhryfwthjlvltffr') { throw 'Linked project mismatch.' }
    $files = @(Get-ChildItem -LiteralPath (Join-Path $Root 'supabase\migrations') -File)
    if ($files.Count -ne 1 -or $files[0].Name -cne '20261104000100_auth_profiles.sql') {
        throw 'The migration directory must contain only the reviewed migration.'
    }
    if ((Get-FileHash -LiteralPath $files[0].FullName -Algorithm SHA256).Hash -ne
        '437DD4C34892252B745F1D29A47864C67F0CD7C333BBCE005503E6687F585FBE') {
        throw 'Migration SHA-256 mismatch.'
    }
    if ((Get-FileHash -LiteralPath $Ca -Algorithm SHA256).Hash -ne
        '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
        throw 'CA SHA-256 mismatch.'
    }
    $certificate = New-Object Security.Cryptography.X509Certificates.X509Certificate2($Ca)
    try {
        if ((Get-Date) -lt $certificate.NotBefore -or (Get-Date) -gt $certificate.NotAfter) {
            throw 'CA certificate is outside its validity period.'
        }
    }
    finally { $certificate.Dispose() }
}

function Invoke-BabulNativePush {
    param([string]$Root, [string]$Cli, [string]$Ca,
          [Security.SecureString]$Password)

    $names = @(
        'SUPABASE_DB_PASSWORD', 'PGSSLMODE', 'PGSSLROOTCERT',
        'PGOPTIONS', 'PGSERVICE', 'PGSERVICEFILE', 'SUPABASE_YES', 'SUPABASE_DEBUG'
    )
    $saved = @{}
    foreach ($name in $names) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    $pointer = [IntPtr]::Zero
    $locationPushed = $false
    $previousPreference = $ErrorActionPreference
    $nativePreferenceVariable = Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $previousNativePreference = $null
    if ($null -ne $nativePreferenceVariable) { $previousNativePreference = $nativePreferenceVariable.Value }

    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
        $env:SUPABASE_DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PASSWORD)) { throw 'Empty database password.' }
        $env:PGSSLMODE = 'verify-full'
        $env:PGSSLROOTCERT = $Ca
        foreach ($name in @('PGOPTIONS','PGSERVICE','PGSERVICEFILE','SUPABASE_YES','SUPABASE_DEBUG')) {
            [Environment]::SetEnvironmentVariable($name, $null, 'Process')
        }

        Push-Location -LiteralPath $Root
        $locationPushed = $true
        # Only --version above captures streams. The production CLI below inherits
        # the terminal directly. Do not pipe, assign, redirect, or inject input.
        $ErrorActionPreference = 'Continue'
        if ($null -ne $nativePreferenceVariable) { $PSNativeCommandUseErrorActionPreference = $false }
        & $Cli db push --linked --skip-vault
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $previousPreference
        if ($exitCode -ne 0) {
            throw "CLI exited with code $exitCode. Stop; do not retry or repair history."
        }
        Write-Host 'CLI exit code: 0. Run the read-only post-apply SQL checks.'
    }
    finally {
        $ErrorActionPreference = $previousPreference
        if ($null -ne $nativePreferenceVariable) { $PSNativeCommandUseErrorActionPreference = $previousNativePreference }
        if ($locationPushed) { Pop-Location }
        foreach ($name in $names) {
            [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process')
        }
        if ($pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }
}

function Start-BabulNativeMigration {
    param([string]$Root, [string]$Cli, [string]$Ca)
    Assert-BabulInteractiveTerminal
    Assert-BabulCliVersion -Cli $Cli
    Assert-BabulMigrationFiles -Root $Root -Ca $Ca

    Write-Host 'PRODUCTION PROJECT: fltaxhryfwthjlvltffr'
    Write-Host 'MIGRATION: 20261104000100_auth_profiles.sql'
    Write-Host 'TLS: verify-full with the reviewed CA'
    Write-Host 'COMMAND: db push --linked --skip-vault'
    Write-Host 'Reviewed SQL:'
    Get-Content -LiteralPath (Join-Path $Root 'supabase\migrations\20261104000100_auth_profiles.sql') |
        ForEach-Object { Write-Host $_ }
    Write-Warning 'At the CLI confirmation, approve only the single reviewed migration. Answer n to anything unexpected.'
    $approval = Read-Host 'Type APPLY fltaxhryfwthjlvltffr 20261104000100 to permit the connection'
    if ($approval -cne 'APPLY fltaxhryfwthjlvltffr 20261104000100') {
        throw 'Approval did not match. No production connection attempted.'
    }

    $password = Read-Host 'Database password (hidden; never saved to disk)' -AsSecureString
    try {
        # Recheck after interactive review, before connecting.
        Assert-BabulInteractiveTerminal
        Assert-BabulCliVersion -Cli $Cli
        Assert-BabulMigrationFiles -Root $Root -Ca $Ca
        Invoke-BabulNativePush -Root $Root -Cli $Cli -Ca $Ca -Password $password
    }
    finally { $password.Dispose() }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$cli = 'C:\Users\DELL\AppData\Local\npm-cache\_npx\aa8e5c70f9d8d161\node_modules\@supabase\cli-windows-x64\bin\supabase.exe'
$ca = 'C:\Users\DELL\BabulLearnBackups\slo-ai\certs\supabase-ca.crt'
Start-BabulNativeMigration -Root $projectRoot -Cli $cli -Ca $ca
