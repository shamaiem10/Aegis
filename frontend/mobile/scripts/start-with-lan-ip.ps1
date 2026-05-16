# Starts Expo so the QR targets this PC's LAN IP (fixes Expo Go "Something went wrong" when Metro shows exp://127.0.0.1).
# IP source: METRO_HOST in frontend/mobile/.env, else hostname from EXPO_PUBLIC_API_URL.

$ErrorActionPreference = "Stop"
$projRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projRoot

$metroHost = $null
$envFile = Join-Path $projRoot ".env"
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    $t = $line.Trim()
    if ($t.Length -eq 0 -or $t.StartsWith("#")) { continue }
    if ($t -match '^\s*METRO_HOST\s*=\s*(.+)\s*$') {
      $metroHost = $Matches[1].Trim().Trim('"').Trim("'")
      break
    }
  }
  if (-not $metroHost) {
    foreach ($line in Get-Content $envFile) {
      $t = $line.Trim()
      if ($t.Length -eq 0 -or $t.StartsWith("#")) { continue }
      if ($t -match '^EXPO_PUBLIC_API_URL\s*=\s*(https?)://([^/:]+)') {
        $metroHost = $Matches[2]
        break
      }
    }
  }
}

if (-not $metroHost) {
  Write-Host 'Missing METRO_HOST or EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:... in .env - add one.' -ForegroundColor Yellow
  exit 1
}

$env:REACT_NATIVE_PACKAGER_HOSTNAME = $metroHost
Write-Host ('Metro advertises REACT_NATIVE_PACKAGER_HOSTNAME=' + $metroHost + ' (use exp://' + $metroHost + ':PORT in QR instead of 127.0.0.1).' ) -ForegroundColor Green

& npx expo start --lan @args
