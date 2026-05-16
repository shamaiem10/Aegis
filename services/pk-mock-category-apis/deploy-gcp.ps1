# Deploy PK mock category APIs to GCP Cloud Run (project aegis-pk-2026 by default).
# Requires: billing enabled, gcloud auth, APIs run + artifactregistry + cloudbuild
param(
  [string]$ProjectId = "aegis-pk-2026",
  [string]$Region = "us-central1",
  [string]$Repo = "aegis-docker",
  [string]$ServiceName = "pk-mock-category-apis",
  [switch]$FourSeparateServices
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$image = "${Region}-docker.pkg.dev/${ProjectId}/${Repo}/${ServiceName}:latest"

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --project=$ProjectId --quiet

$repoExists = gcloud artifacts repositories describe $Repo --location=$Region --project=$ProjectId 2>$null
if (-not $repoExists) {
  gcloud artifacts repositories create $Repo --repository-format=docker --location=$Region --project=$ProjectId
}

gcloud builds submit --tag $image --project=$ProjectId .

if ($FourSeparateServices) {
  $slugs = @("accidents", "earthquakes", "floods", "disease")
  foreach ($slug in $slugs) {
    $name = "pk-mock-$slug"
    gcloud run deploy $name `
      --image $image `
      --region $Region `
      --platform managed `
      --allow-unauthenticated `
      --set-env-vars "MOCK_CATEGORY_ONLY=$slug" `
      --project=$ProjectId
    $url = gcloud run services describe $name --region $Region --project $ProjectId --format "value(status.url)"
    Write-Host "$slug -> $url/api/v1/signals/mock/$slug"
  }
} else {
  gcloud run deploy $ServiceName `
    --image $image `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --project=$ProjectId
  $url = gcloud run services describe $ServiceName --region $Region --project $ProjectId --format "value(status.url)"
  Write-Host ""
  Write-Host "EXPO_PUBLIC_PK_MOCK_ALERTS_URL=$url"
}
