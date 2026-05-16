# Deploy all four PK mock category APIs to Vercel (one origin, four paths).
# Requires: npm install, npx vercel login (once)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm run build
npx vercel deploy --prod --yes
Write-Host ""
Write-Host "Set in frontend/mobile/.env:"
Write-Host "EXPO_PUBLIC_PK_MOCK_ALERTS_URL=https://pk-mock-category-apis.vercel.app"
Write-Host ""
Write-Host "Endpoints:"
Write-Host "  /api/v1/signals/mock/accidents"
Write-Host "  /api/v1/signals/mock/earthquakes"
Write-Host "  /api/v1/signals/mock/floods"
Write-Host "  /api/v1/signals/mock/disease"
Write-Host "  /api/v1/signals/live/parsed"
