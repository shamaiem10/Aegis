$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm run build
npx vercel deploy --prod --yes
Write-Host ""
Write-Host "Set in frontend/mobile/.env and cloud-run/.env:"
Write-Host "EXPO_PUBLIC_PK_RESOURCES_URL=https://pk-resource-inventory-api.vercel.app"
Write-Host "PK_RESOURCES_INVENTORY_URL=https://pk-resource-inventory-api.vercel.app"
Write-Host ""
Write-Host "GET /api/v1/resources/inventory"
Write-Host "GET /api/v1/resources/inventory/islamabad"
