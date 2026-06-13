# Start Forge server + Electron IDE against local Skia-FULL (not production).
# Prereqs: Skia-FULL backend :4000, frontend :3000, Skia-Serve :11500, Postgres.
#
# Usage (PowerShell):
#   cd C:\SKIA-Forge
#   .\local-dev\scripts\start-forge-local.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$LoadScript = Join-Path $ScriptDir "load-forge-local-env.ps1"
$ApplyIdePatch = Join-Path $ScriptDir "apply-forge-ide-local-patch.ps1"

. $LoadScript
. $ApplyIdePatch

$port = $env:SKIA_PORT
Write-Host ""
Write-Host "[start-forge-local] Starting Forge server on :$port"
Write-Host "  backend: $($env:LOCAL_SKIA_BACKEND_URL)"
Write-Host "  chat:    $($env:LOCAL_CHAT_PIPELINE_URL)"
Write-Host "  sign in: $($env:SKIA_OWNER_EMAIL) (password from Skia-FULL LOCAL_FOUNDER_PASSWORD or your account)"
Write-Host ""

$serverCmd = @"
Set-Location '$Repo'
. '$LoadScript'
npm run dev
"@

$ideCmd = @"
Set-Location '$Repo'
. '$ApplyIdePatch'
Set-Location '$Repo\skia-ide'
. '$LoadScript'
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $ideCmd

Write-Host "[start-forge-local] Opened two windows (Forge server + IDE)."
Write-Host "  Forge health: http://localhost:$port/health"
Write-Host "  Local probes: http://localhost:$port/api/local/health"
Write-Host "  IDE: LOCAL nav for stack status"
Write-Host ""
Write-Host "  Local-only: skia-ide patched via local-dev/ide-overrides/ (not for production builds)."
Write-Host "  To restore skia-ide source: . .\local-dev\scripts\revert-forge-ide-local-patch.ps1"
