# Restores skia-ide/ from git after local-dev overrides were applied.
# Usage: . .\local-dev\scripts\revert-forge-ide-local-patch.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$Marker = Join-Path $Repo ".local-dev-ide-patch-applied"

if (-not (Test-Path $Marker)) {
    Write-Host "[revert-forge-ide-local-patch] Not applied - nothing to revert."
    return
}

Push-Location $Repo
try {
    git checkout -- skia-ide/
    if ($LASTEXITCODE -ne 0) {
        throw "git checkout -- skia-ide/ failed"
    }
    Remove-Item $Marker -Force -ErrorAction SilentlyContinue
    Write-Host "[revert-forge-ide-local-patch] skia-ide/ restored to repo source."
}
finally {
    Pop-Location
}
