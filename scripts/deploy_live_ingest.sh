#!/usr/bin/env bash
# Deploy live hourly ingest: Cloud Run + GCS bucket + Cloud Scheduler (Europe/London :05).
#
# Prerequisites (one-time, manual):
#   gcloud auth login
#   gcloud auth application-default login   # optional for local --gcs tests
#   firebase login                         # for Hosting later
#   Create Secret Manager secret EXPOSURE_API_KEY (see docs/FIREBASE_LIVE_INGEST.md)
#
# Usage:
#   ./scripts/deploy_live_ingest.sh              # deploy Run + ensure bucket + scheduler
#   ./scripts/deploy_live_ingest.sh --run-only   # Cloud Run only (skip bucket/scheduler)
#   ./scripts/deploy_live_ingest.sh --scheduler-only

set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"

PROJECT_ID="${GCP_PROJECT:-nhs-patient-records}"
PROJECT_NUMBER="${GCP_PROJECT_NUMBER:-401361224018}"
REGION="${GCP_REGION:-europe-west2}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-live-ingest}"
BUCKET="${GCS_BUCKET:-${PROJECT_ID}-live}"
SCHEDULER_JOB="${SCHEDULER_JOB:-live-ingest-hourly}"
SCHEDULER_SA="${SCHEDULER_SA:-scheduler-live-ingest@${PROJECT_ID}.iam.gserviceaccount.com}"
SCHEDULE="${SCHEDULE:-5 * * * *}"
TIME_ZONE="${TIME_ZONE:-Europe/London}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

RUN_ONLY=false
SCHEDULER_ONLY=false
PUBLIC_DATA=false
for arg in "$@"; do
  case "$arg" in
    --run-only) RUN_ONLY=true ;;
    --scheduler-only) SCHEDULER_ONLY=true ;;
    --public-data) PUBLIC_DATA=true ;;
  esac
done

echo "==> Project: ${PROJECT_ID} (${PROJECT_NUMBER}) region ${REGION}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud not found. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "ERROR: gcloud not authenticated. Run: gcloud auth login"
  exit 1
fi
echo "    gcloud account: ${ACTIVE_ACCOUNT}"

CURRENT_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo "    Setting gcloud project to ${PROJECT_ID}"
  gcloud config set project "$PROJECT_ID"
fi

DESCRIBE="$(gcloud projects describe "$PROJECT_ID" --format='value(projectId,projectNumber)' 2>&1)" || {
  echo "ERROR: Cannot describe project ${PROJECT_ID}. Check billing and IAM."
  echo "$DESCRIBE"
  exit 1
}
echo "    Verified: $DESCRIBE"

if [ "$SCHEDULER_ONLY" = false ]; then
  echo "==> Enabling APIs"
  gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    storage.googleapis.com \
    cloudscheduler.googleapis.com \
    secretmanager.googleapis.com \
    --project="$PROJECT_ID"

  if [ "$RUN_ONLY" = false ]; then
    echo "==> GCS bucket gs://${BUCKET}"
    if gsutil ls -b "gs://${BUCKET}" >/dev/null 2>&1; then
      echo "    Bucket exists"
    else
      gsutil mb -p "$PROJECT_ID" -l "$REGION" -b on "gs://${BUCKET}"
      echo "    Created bucket"
    fi
  fi

  echo "==> Deploy Cloud Run ${SERVICE_NAME}"
  AUTH_FLAG="--no-allow-unauthenticated"
  RUN_ENV="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GCS_BUCKET=${BUCKET},GCS_PREFIX=live"
  if [ "$PUBLIC_DATA" = true ]; then
    AUTH_FLAG="--allow-unauthenticated"
    RUN_ENV="${RUN_ENV},REQUIRE_RUN_BEARER=1"
    echo "    --public-data: unauthenticated GET /data/live/*; /run requires Bearer token"
  fi
  # Secret must exist before deploy (--set-secrets). Create manually if missing.
  if ! gcloud secrets describe EXPOSURE_API_KEY --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "WARNING: Secret EXPOSURE_API_KEY not found in Secret Manager."
    echo "         Create it before production runs (see docs/FIREBASE_LIVE_INGEST.md)."
    echo "         Deploying without --set-secrets; set EXPOSURE_API_KEY env manually or redeploy."
    gcloud run deploy "$SERVICE_NAME" \
      --source=. \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      $AUTH_FLAG \
      --timeout=120 \
      --memory=512Mi \
      --cpu=1 \
      --max-instances=1 \
      --set-env-vars="$RUN_ENV"
  else
    gcloud run deploy "$SERVICE_NAME" \
      --source=. \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      $AUTH_FLAG \
      --timeout=120 \
      --memory=512Mi \
      --cpu=1 \
      --max-instances=1 \
      --set-env-vars="$RUN_ENV" \
      --set-secrets="EXPOSURE_API_KEY=EXPOSURE_API_KEY:latest"
  fi

  RUN_SA="$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
  if [ -z "$RUN_SA" ]; then
    RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  fi
  echo "    Cloud Run service account: ${RUN_SA}"

  echo "==> Grant Storage object admin on gs://${BUCKET}"
  gsutil iam ch "serviceAccount:${RUN_SA}:roles/storage.objectAdmin" "gs://${BUCKET}" || true
fi

if [ "$RUN_ONLY" = true ]; then
  echo "==> Done (--run-only)"
  exit 0
fi

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)')"
echo "==> Cloud Run URL: ${SERVICE_URL}"

echo "==> Scheduler service account ${SCHEDULER_SA}"
if ! gcloud iam service-accounts describe "$SCHEDULER_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create scheduler-live-ingest \
    --project="$PROJECT_ID" \
    --display-name="Live ingest Cloud Scheduler"
fi

gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker" \
  --quiet

if gcloud scheduler jobs describe "$SCHEDULER_JOB" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "==> Update Scheduler job ${SCHEDULER_JOB}"
  gcloud scheduler jobs update http "$SCHEDULER_JOB" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="${SERVICE_URL}/run" \
    --http-method=GET \
    --oidc-service-account-email="$SCHEDULER_SA" \
    --oidc-token-audience="$SERVICE_URL"
else
  echo "==> Create Scheduler job ${SCHEDULER_JOB} (${SCHEDULE} ${TIME_ZONE})"
  gcloud scheduler jobs create http "$SCHEDULER_JOB" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="${SERVICE_URL}/run" \
    --http-method=GET \
    --oidc-service-account-email="$SCHEDULER_SA" \
    --oidc-token-audience="$SERVICE_URL"
fi

echo ""
echo "Deploy complete."
echo "  Bucket:   gs://${BUCKET}/live/"
echo "  Run:      ${SERVICE_URL}/run  (Scheduler OIDC only)"
echo "  Health:   ${SERVICE_URL}/health"
echo ""
echo "Manual smoke (needs identity token):"
echo "  curl -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" ${SERVICE_URL}/health"
