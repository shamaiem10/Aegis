# Build Android APK (EAS) and stage for cloud-run download page.
# Prerequisites: npx expo login, EAS project linked (npx eas init once).
param(
  [switch]$SkipBuild,
  [string]$CopyTo = ""
)

$ErrorActionPreference = "Stop"
$MobileRoot = Split-Path $PSScriptRoot -Parent
$ReleaseDir = Join-Path $MobileRoot "releases"
$ApkName = "aegis-mobile.apk"
$Staged = Join-Path $ReleaseDir $ApkName

New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null

if (-not $SkipBuild) {
  Write-Host "Starting EAS build (Android APK, profile: preview)..."
  Push-Location $MobileRoot
  try {
    npx eas-cli build --platform android --profile preview --non-interactive
  } finally {
    Pop-Location
  }

  Write-Host "Downloading latest finished build artifact..."
  Push-Location $MobileRoot
  try {
    npx eas-cli build:download --platform android --profile preview --output $Staged --latest-finished
  } catch {
    Write-Host "eas build:download failed — download APK from https://expo.dev and save as:"
    Write-Host "  $Staged"
    exit 1
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $Staged)) {
  Write-Host "Missing $Staged — place the APK there or re-run without -SkipBuild."
  exit 1
}

$CloudRunRelease = Join-Path $MobileRoot "..\..\cloud-run\releases"
New-Item -ItemType Directory -Force -Path $CloudRunRelease | Out-Null
$CloudApk = Join-Path $CloudRunRelease $ApkName
Copy-Item -Force $Staged $CloudApk

if ($CopyTo) {
  Copy-Item -Force $Staged $CopyTo
}

$port = if ($env:PORT) { $env:PORT } else { "8080" }
Write-Host ""
Write-Host "APK staged:"
Write-Host "  $Staged"
Write-Host "  $CloudApk"
Write-Host ""
Write-Host "Download page (restart cloud-run if needed):"
Write-Host "  http://localhost:${port}/download"
Write-Host "  http://localhost:${port}/download/apk"
