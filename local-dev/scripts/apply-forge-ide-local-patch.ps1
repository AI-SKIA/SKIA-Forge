# Copies local-dev/ide-overrides into skia-ide/ (local development only).
# Production builds must NOT run this script.
# Usage: . .\local-dev\scripts\apply-forge-ide-local-patch.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$OverrideRoot = Join-Path $Repo "local-dev\ide-overrides"
$Marker = Join-Path $Repo ".local-dev-ide-patch-applied"

if (-not (Test-Path $OverrideRoot)) {
    throw "Missing override tree: $OverrideRoot"
}

$files = Get-ChildItem -Path $OverrideRoot -Recurse -File
if ($files.Count -eq 0) {
    throw "No override files under $OverrideRoot"
}

foreach ($file in $files) {
    $rel = $file.FullName.Substring($OverrideRoot.Length).TrimStart("\", "/")
    $dest = Join-Path $Repo $rel
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    }
    Copy-Item -Path $file.FullName -Destination $dest -Force
}

Set-Content -Path $Marker -Value (Get-Date -Format "o")
Write-Host ("[apply-forge-ide-local-patch] Applied {0} override file(s) into skia-ide/." -f $files.Count)
