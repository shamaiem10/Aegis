#!/bin/bash
set -e

PROJECT_ID="aegis-496207"
REGION="us-central1"
SERVICE_ACCOUNT="firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com"

SECRETS=(
  "OPENAQ_API_KEY"
  "IQAIR_API_KEY"
  "HERE_API_KEY"
  "TWITTER_API_KEY"
  "REDDIT_CLIENT_ID"
  "REDDIT_CLIENT_SECRET"
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
  "TWILIO_FROM_NUMBER"
  "SENDGRID_API_KEY"
  "GOOGLE_MAPS_SERVER_KEY"
)

echo "===================================================="
echo "1. Creating GCP Secrets (with placeholder values)"
echo "===================================================="

for SECRET_NAME in "${SECRETS[@]}"; do
  # Check if secret exists
  if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Secret $SECRET_NAME already exists. Skipping creation."
  else
    echo "Creating secret $SECRET_NAME..."
    echo -n "PLACEHOLDER_VALUE" | gcloud secrets create "$SECRET_NAME" --project="$PROJECT_ID" --data-file=-
  fi
done

echo ""
echo "!!! Please ensure you update these placeholder values in the GCP Console Secret Manager !!!"
echo ""

echo "===================================================="
echo "2. Granting Service Account Secret Accessor Role"
echo "===================================================="

for SECRET_NAME in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
    --project="$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done
echo "Granted secretAccessor role to $SERVICE_ACCOUNT for all secrets."

echo "===================================================="
echo "3. Submitting Cloud Build"
echo "===================================================="
gcloud builds submit --config cloudbuild.yaml --project="$PROJECT_ID"

# Fetch the Cloud Run URL
echo "Fetching deployed Cloud Run URL..."
SERVICE_URL=$(gcloud run services describe crisis-api-gateway --platform managed --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)")

if [ -z "$SERVICE_URL" ]; then
  echo "Failed to retrieve Cloud Run URL. Ensure deployment was successful."
  exit 1
fi
echo "Service URL: $SERVICE_URL"

echo "===================================================="
echo "4. Creating Cloud Scheduler Jobs"
echo "===================================================="

create_or_update_job() {
  local JOB_NAME=$1
  local SCHEDULE=$2
  local URI=$3

  # Check if job exists
  if gcloud scheduler jobs describe "$JOB_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Updating existing job $JOB_NAME..."
    gcloud scheduler jobs update http "$JOB_NAME" \
      --location="$REGION" \
      --project="$PROJECT_ID" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=POST \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$SERVICE_URL"
  else
    echo "Creating new job $JOB_NAME..."
    gcloud scheduler jobs create http "$JOB_NAME" \
      --location="$REGION" \
      --project="$PROJECT_ID" \
      --schedule="$SCHEDULE" \
      --uri="$URI" \
      --http-method=POST \
      --oidc-service-account-email="$SERVICE_ACCOUNT" \
      --oidc-token-audience="$SERVICE_URL"
  fi
}

create_or_update_job "antigravity-pipeline" "* * * * *" "${SERVICE_URL}/pipeline/run"
create_or_update_job "pmd-scraper" "*/10 * * * *" "${SERVICE_URL}/scrape/pmd"
create_or_update_job "ndma-scraper" "*/15 * * * *" "${SERVICE_URL}/scrape/ndma"
create_or_update_job "api-health-check" "* * * * *" "${SERVICE_URL}/health/check-apis"

echo "===================================================="
echo "DEPLOYMENT COMPLETE!"
echo "===================================================="
echo ""
echo "CRITICAL NEXT STEP:"
echo "Copy the following line into your .env file so your mobile app and local tools know where to send requests:"
echo ""
echo "CLOUD_RUN_GATEWAY_URL=${SERVICE_URL}"
echo ""
