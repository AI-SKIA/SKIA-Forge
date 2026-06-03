# Loads local-dev/.env.forge.local and maps LOCAL_* to Forge runtime env.
# Usage (from SKIA-Forge repo root):
#   . .\local-dev\scripts\load-forge-local-env.ps1
#   npm run dev

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptDir
$Repo = Split-Path -Parent $Root
$EnvFile = if ($env:ENV_FILE) { $env:ENV_FILE } else { Join-Path $Root ".env.forge.local" }
$Example = Join-Path $Root ".env.forge.local.example"

if (-not (Test-Path $EnvFile)) {
  if (-not (Test-Path $Example)) {
    throw "Missing $EnvFile and $Example"
  }
  Write-Host "[load-forge-local-env] Missing $EnvFile - copying example."
  Copy-Item $Example $EnvFile
}

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $eq = $line.IndexOf("=")
  if ($eq -lt 1) { return }
  $name = $line.Substring(0, $eq).Trim()
  $value = $line.Substring($eq + 1).Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$name" -Value $value
}

if ($env:LOCAL_SKIA_BACKEND_URL) {
  $env:SKIA_BACKEND_URL = $env:LOCAL_SKIA_BACKEND_URL
  $env:SKIA_FULL_API_URL = $env:LOCAL_SKIA_BACKEND_URL
}
if ($env:LOCAL_FORGE_URL) {
  $env:SKIA_FORGE_URL = $env:LOCAL_FORGE_URL
}
if ($env:LOCAL_CHAT_PIPELINE_URL) {
  $env:SKIA_CHAT_PIPELINE_URL = $env:LOCAL_CHAT_PIPELINE_URL
}
if ($env:LOCAL_FORGE_AGENT_PIPELINE_URL) {
  $env:SKIA_FORGE_AGENT_PIPELINE_URL = $env:LOCAL_FORGE_AGENT_PIPELINE_URL
}

if (-not $env:SKIA_PORT) { $env:SKIA_PORT = "4173" }
$env:NODE_ENV = "development"

if (-not $env:SKIA_OWNER_EMAIL) {
  $env:SKIA_OWNER_EMAIL = "dany.francis@consultant.com"
}
if (-not $env:LOCAL_FOUNDER_OVERRIDE) {
  $env:LOCAL_FOUNDER_OVERRIDE = "true"
}
if (-not $env:LOCAL_FORGE_SOVEREIGN_MODE) {
  $env:LOCAL_FORGE_SOVEREIGN_MODE = "autonomous"
}

# Forge validates JWTs locally — must match Skia-FULL login service.
if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Trim().Length -lt 32) {
  $skiaFullRoot = $env:SKIA_FULL_ROOT
  if (-not $skiaFullRoot) {
    $sibling = Join-Path (Split-Path -Parent $Repo) "Skia-FULL"
    if (Test-Path $sibling) { $skiaFullRoot = $sibling } else { $skiaFullRoot = "C:\Skia-FULL" }
  }
  foreach ($candidate in @(
      (Join-Path $skiaFullRoot ".env"),
      (Join-Path $skiaFullRoot ".env.local")
    )) {
    if (-not (Test-Path $candidate)) { continue }
    Get-Content $candidate | ForEach-Object {
      $line = $_.Trim()
      if ($line -eq "" -or $line.StartsWith("#")) { return }
      $eq = $line.IndexOf("=")
      if ($eq -lt 1) { return }
      $name = $line.Substring(0, $eq).Trim()
      if ($name -ne "JWT_SECRET") { return }
      $value = $line.Substring($eq + 1).Trim().Trim('"')
      if ($value.Length -ge 32) { $env:JWT_SECRET = $value }
    }
    if ($env:JWT_SECRET -and $env:JWT_SECRET.Trim().Length -ge 32) { break }
  }
  if (-not $env:JWT_SECRET -or $env:JWT_SECRET.Trim().Length -lt 32) {
    throw "JWT_SECRET missing or too short. Set in local-dev/.env.forge.local or Skia-FULL .env (must match backend)."
  }
}

Write-Host ('[load-forge-local-env] SKIA_PORT=' + $env:SKIA_PORT + ' backend=' + $env:LOCAL_SKIA_BACKEND_URL + ' founder=' + $env:SKIA_OWNER_EMAIL)
