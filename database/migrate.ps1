# migrate.ps1 - Run all migrations in order
# Usage: .\migrate.ps1

# Force UTF-8 output when piping to native commands (fixes Chinese encoding in PS 5.1)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$EnvFile       = "$PSScriptRoot\..\docker\.env"
$MigrationsDir = "$PSScriptRoot\migrations"
$Container     = "chungyo_mysql"

# Read .env file
if (-not (Test-Path $EnvFile)) {
  Write-Error "Cannot find $EnvFile. Please create docker/.env first."
  exit 1
}

$env_vars = @{}
Get-Content $EnvFile | Where-Object { $_ -match "^\s*[^#]" } | ForEach-Object {
  $parts = $_ -split "=", 2
  if ($parts.Count -eq 2) {
    $env_vars[$parts[0].Trim()] = $parts[1].Trim()
  }
}

$DB_USER = $env_vars["MYSQL_USER"]
$DB_PASS = $env_vars["MYSQL_PASSWORD"]
$DB_NAME = $env_vars["MYSQL_DATABASE"]

if (-not $DB_USER -or -not $DB_PASS -or -not $DB_NAME) {
  Write-Error "docker/.env is missing required fields (MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE)"
  exit 1
}

# Check container is running
$running = docker ps --filter "name=$Container" --filter "status=running" -q
if (-not $running) {
  Write-Error "Container '$Container' is not running. Please run: docker compose up -d"
  exit 1
}

# Get all migration files sorted by name
$files = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Host "No SQL files found in migrations/"
  exit 0
}

Write-Host ""
Write-Host "Database : $DB_NAME"
Write-Host "Files    : $($files.Count)"
Write-Host "----------------------------------------"

$success = 0
$failed  = 0

foreach ($file in $files) {
  Write-Host -NoNewline "  $($file.Name) ... "

  $sql    = Get-Content $file.FullName -Raw -Encoding UTF8
  $result = $sql | docker exec -i $Container mysql --default-character-set=utf8mb4 -u $DB_USER -p"$DB_PASS" $DB_NAME 2>&1

  if ($LASTEXITCODE -eq 0) {
    Write-Host "OK" -ForegroundColor Green
    $success++
  } else {
    Write-Host "FAILED" -ForegroundColor Red
    Write-Host "    $result" -ForegroundColor Red
    $failed++
    $ans = Read-Host "  Continue with remaining files? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") {
      Write-Host "Aborted." -ForegroundColor Yellow
      break
    }
  }
}

Write-Host "----------------------------------------"
Write-Host "Done: $success OK, $failed failed"
Write-Host ""
