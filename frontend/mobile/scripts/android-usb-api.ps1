# Android phone over USB — maps device localhost:8080 → PC cloud-run (bypasses campus Wi-Fi isolation)
$ErrorActionPreference = "Stop"
adb reverse tcp:8080 tcp:8080
Write-Host ""
Write-Host "USB reverse active. In frontend/mobile/.env set:"
Write-Host "  EXPO_PUBLIC_API_URL=http://127.0.0.1:8080"
Write-Host "  METRO_HOST=127.0.0.1"
Write-Host ""
Write-Host "Then: npm run start:clear"
Write-Host "Keep cloud-run running: cd cloud-run; npm run dev"
