param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    throw "Python was not found on PATH. Activate the project's Python environment and retry."
}

& $python.Source -c "import psycopg" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "psycopg is missing. Install it with: python -m pip install -r `"$PSScriptRoot\requirements-import.txt`""
}

$poolerHost = Read-Host "Supabase Session Pooler host (for example aws-0-region.pooler.supabase.com)"
if ($poolerHost -notmatch '^[A-Za-z0-9.-]+\.pooler\.supabase\.com$') {
    throw "Host must be the Supabase Session Pooler hostname ending in .pooler.supabase.com."
}

$poolerUser = Read-Host "Pooler database username (usually postgres.<project-ref>)"
if ([string]::IsNullOrWhiteSpace($poolerUser)) {
    throw "Pooler username is required."
}

$databaseName = Read-Host "Database name [postgres]"
if ([string]::IsNullOrWhiteSpace($databaseName)) {
    $databaseName = "postgres"
}
if ($databaseName -notmatch '^[A-Za-z0-9_-]+$') {
    throw "Database name contains unsupported characters."
}

$securePassword = Read-Host "Database password (input is hidden)" -AsSecureString
$passwordPointer = [IntPtr]::Zero
$previousDatabaseUrl = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process")
$hadPreviousDatabaseUrl = $null -ne $previousDatabaseUrl

try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $encodedUser = [Uri]::EscapeDataString($poolerUser)
    $encodedPassword = [Uri]::EscapeDataString($plainPassword)
    $env:DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@${poolerHost}:5432/${databaseName}"
    Remove-Variable plainPassword, encodedPassword -ErrorAction SilentlyContinue

    Push-Location $repoRoot
    try {
        if ($Apply) {
            $confirmation = Read-Host 'Type "IMPORT 1150 APPROVED SLOS" to run the production import'
            if ($confirmation -cne "IMPORT 1150 APPROVED SLOS") {
                throw "Confirmation did not match; no import was run."
            }
            & $python.Source ".\scripts\import_verified_syllabus.py" "--apply"
        }
        else {
            & $python.Source ".\scripts\import_verified_syllabus.py"
        }
        if ($LASTEXITCODE -ne 0) {
            throw "Importer exited with code $LASTEXITCODE. It aborted and rolled back; review the redacted output."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    if ($hadPreviousDatabaseUrl) {
        [Environment]::SetEnvironmentVariable("DATABASE_URL", $previousDatabaseUrl, "Process")
    }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
    Remove-Variable encodedUser, poolerUser, securePassword -ErrorAction SilentlyContinue
}
