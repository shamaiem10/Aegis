# Deploy AEGIS API to Cloud Run (public HTTPS, project aegis-496207).
# Prerequisites: gcloud CLI, logged in, billing enabled on project.
# Usage (from repo root or cloud-run):
#   powershell -ExecutionPolicy Bypass -File cloud-run/scripts/deploy-public.ps1

$ErrorActionPreference = "Stop"

$ProjectId = "aegis-496207"
$Region = "us-central1"
$ServiceName = "crisis-api-gateway"
$ServiceAccount = "firebase-adminsdk-fbsvc@${ProjectId}.iam.gserviceaccount.com"
$CloudRunDir = Split-Path $PSScriptRoot -Parent

Set-Location $CloudRunDir
Write-Host "Deploying from: $CloudRunDir"

Write-Host "`n=== gcloud project ===" -ForegroundColor Cyan
gcloud config set project $ProjectId

Write-Host "`n=== Enabling APIs (idempotent) ===" -ForegroundColor Cyan
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project=$ProjectId

function Read-DotEnvLine {
  param([string]$Path)
  $map = @{}
  if (-not (Test-Path $Path)) { return $map }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    if ($k) { $map[$k] = $v }
  }
  return $map
}

$envFile = Join-Path $CloudRunDir ".env"
$dot = Read-DotEnvLine $envFile

# Env vars safe to set on Cloud Run (no local file paths)
$envKeys = @(
  "GCP_PROJECT_ID",
  "GCP_REGION",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "LLM_PROVIDER",
  "LLM_PRIMARY",
  "LLM_MAX_OUTPUT_TOKENS",
  "GROQ_MODEL",
  "GEMINI_VERTEX_MODEL",
  "GEMINI_MAX_OUTPUT_TOKENS",
  "PIPELINE_FAST_MODE",
  "PK_RESOURCES_INVENTORY_URL",
  "PK_MOCK_ALERTS_URL",
  "MOBILE_APK_DOWNLOAD_URL"
)

$envPairs = @(
  "GCP_PROJECT_ID=$ProjectId",
  "GOOGLE_CLOUD_PROJECT=$ProjectId",
  "GCLOUD_PROJECT=$ProjectId",
  "GCP_REGION=$Region",
  "NODE_ENV=production"
)

foreach ($key in $envKeys) {
  if ($dot.ContainsKey($key) -and $dot[$key]) {
    $val = $dot[$key] -replace ",", "\,"
    $envPairs += "${key}=${val}"
  }
}

# API keys from .env (use Secret Manager for production hardening)
$secretKeys = @(
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENAQ_API_KEY",
  "IQAIR_API_KEY",
  "HERE_API_KEY",
  "WEATHER_API_KEY"
)

foreach ($key in $secretKeys) {
  if ($dot.ContainsKey($key) -and $dot[$key]) {
    $val = $dot[$key] -replace ",", "\,"
    $envPairs += "${key}=${val}"
  }
}

$envCsv = ($envPairs -join ",")
Write-Host "`n=== Deploying to Cloud Run (public) ===" -ForegroundColor Cyan
Write-Host "Service: $ServiceName  Region: $Region"

gcloud run deploy $ServiceName `
  --source . `
  --region $Region `
  --project $ProjectId `
  --platform managed `
  --allow-unauthenticated `
  --service-account $ServiceAccount `
  --memory 2Gi `
  --cpu 2 `
  --min-instances 0 `
  --max-instances 10 `
  --port 8080 `
  --set-env-vars $envCsv

$ServiceUrl = gcloud run services describe $ServiceName `
  --region $Region `
  --project $ProjectId `
  --format "value(status.url)"

if (-not $ServiceUrl) {
  Write-Host "Deploy finished but could not read service URL." -ForegroundColor Red
  exit 1
}

Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
Write-Host "Public API URL:"
Write-Host "  $ServiceUrl"
Write-Host ""
Write-Host "Health:  $ServiceUrl/health"
Write-Host "APK page: $ServiceUrl/download"
Write-Host ""
Write-Host "Update frontend/mobile/.env then rebuild APK:" -ForegroundColor Yellow
Write-Host "  EXPO_PUBLIC_API_URL=$ServiceUrl"
Write-Host ""
Write-Host "Quick test:"
Write-Host "  curl $ServiceUrl/health"

# Write snippet for mobile .env
$mobileEnv = Join-Path $CloudRunDir "..\frontend\mobile\.env"
if (Test-Path $mobileEnv) {
  $content = Get-Content $mobileEnv -Raw
  if ($content -match "EXPO_PUBLIC_API_URL=.*") {
    $content = $content -replace "EXPO_PUBLIC_API_URL=.*", "EXPO_PUBLIC_API_URL=$ServiceUrl"
  } else {
    $content += "`nEXPO_PUBLIC_API_URL=$ServiceUrl`n"
  }
  Set-Content -Path $mobileEnv -Value $content.TrimEnd() -NoNewline
  Write-Host "`nUpdated $mobileEnv with EXPO_PUBLIC_API_URL" -ForegroundColor Green
}

Write-Host "`nRebuild APK so installers get the public URL baked in:"
Write-Host "  cd frontend\mobile"
Write-Host "  npm run build:apk"
