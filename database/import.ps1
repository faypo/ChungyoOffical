# import.ps1 - Wrapper that delegates to import.js (Node.js / Prisma)
# Usage: cd <project-root>; .\database\import.ps1
# On Linux/macOS: node database/import.js

$root = Split-Path $PSScriptRoot -Parent
$importJs = Join-Path $PSScriptRoot "import.js"

if (-not (Test-Path $importJs)) {
  Write-Host "ERROR: import.js not found at $importJs" -ForegroundColor Red
  exit 1
}

# Check node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: node.js is not installed or not in PATH" -ForegroundColor Red
  exit 1
}

Set-Location $root
node $importJs
exit $LASTEXITCODE
