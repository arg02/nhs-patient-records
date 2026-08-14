# Firebase / GCP live ingest (production)

Hourly Exposure API + London Air Future forecast → **Cloud Storage** `live/*.json`.  
**Cloud Run** (not Cloud Functions) in **`europe-west2`**, triggered by **Cloud Scheduler** at **:05 Europe/London**.

Firebase **Hosting + password auth** are documented below; ingest is the first phase to stand up.

## GCP project

| Field | Value |
|-------|--------|
| Project ID | `nhs-patient-records` |
| Project number | `401361224018` |
| Region | `europe-west2` |
| Cloud Run service | `live-ingest` |
| GCS bucket | `nhs-patient-records-live` (prefix `live/`) |
| Scheduler | `live-ingest-hourly` — `5 * * * *`, `Europe/London` — **ENABLED** |
| Service URL | `https://live-ingest-401361224018.europe-west2.run.app` (auth required; Scheduler uses OIDC) |

Verify:

```bash
gcloud projects describe nhs-patient-records
```

## Auth prerequisites

Run locally (once per machine):

```bash
gcloud auth login
gcloud auth application-default login   # optional: local --gcs tests
gcloud config set project nhs-patient-records
firebase login                         # Hosting later
```

If deploy fails with billing or permission errors, fix in [Cloud Console](https://console.cloud.google.com/) then re-run `./scripts/deploy_live_ingest.sh`.

### First deploy on a new Blaze project

Cloud Run `--source` deploy uses the **default compute service account** (`401361224018-compute@developer.gserviceaccount.com`). If build fails with permission errors, grant that SA (and the Cloud Build service account) at least:

- `roles/cloudbuild.builds.builder`, `roles/artifactregistry.writer`, `roles/storage.objectAdmin`, `roles/logging.logWriter`, `roles/run.developer` on the compute SA
- `roles/run.admin`, `roles/artifactregistry.writer`, `roles/storage.admin` on the Cloud Build SA

Then re-run `./scripts/deploy_live_ingest.sh`. If scheduler IAM fails immediately after creating `scheduler-live-ingest@…`, wait a minute and run `./scripts/deploy_live_ingest.sh --scheduler-only`.

## Secret Manager — EXPOSURE_API_KEY

Create the secret **manually** (do not commit the key):

```bash
gcloud config set project nhs-patient-records

# First time only — paste key at prompt (or pipe from a local file you control)
gcloud secrets create EXPOSURE_API_KEY \
  --replication-policy=automatic

echo -n 'YOUR_KEY_HERE' | gcloud secrets versions add EXPOSURE_API_KEY --data-file=-
```

Grant Cloud Run’s runtime service account access (replace `RUN_SA` if yours differs):

```bash
PROJECT_NUMBER=401361224018
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding EXPOSURE_API_KEY \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

Redeploy after the secret exists so `--set-secrets=EXPOSURE_API_KEY=EXPOSURE_API_KEY:latest` is applied.

## Deploy

From repo root:

```bash
chmod +x scripts/deploy_live_ingest.sh
./scripts/deploy_live_ingest.sh
```

This enables APIs, creates the bucket if missing, deploys Cloud Run from source (`cloud_run/server.mjs` → `npm start`), grants Storage + Scheduler IAM, and creates/updates the hourly job.

Options:

- `./scripts/deploy_live_ingest.sh --run-only` — Cloud Run only
- `./scripts/deploy_live_ingest.sh --scheduler-only` — Scheduler + IAM only
- `./scripts/deploy_live_ingest.sh --public-data` — allow unauthenticated GET `/data/live/*` (sets `REQUIRE_RUN_BEARER=1` on `/run`)

## serveLiveData (browser reads)

Cloud Run serves GCS JSON for `live.html`:

| Route | Source |
|-------|--------|
| `GET /data/live/index.json` | `gs://…/live/index.json` |
| `GET /data/live/{YYYY-MM-DD}.json` | `gs://…/live/{date}.json` |

Responses use `Cache-Control: no-store`. Implementation: `cloud_run/server.mjs` + `js/live-storage.js` (GCS adapter).

### Auth tradeoff

| Mode | `/run` | `/data/live/*` | Use when |
|------|--------|----------------|----------|
| Default (`--no-allow-unauthenticated`) | Scheduler OIDC only | `siteGate` proxy (session cookie) → Run SA invoke | **Firebase Hosting production** |
| `--public-data` | Bearer token required in app (`REQUIRE_RUN_BEARER=1`) | Public GET + CORS | Local `?storage=gcs` against Run URL |

`firebase.json` rewrites `/data/live/**` → `siteGate` (not direct Run). Grant `roles/run.invoker` to the **Functions runtime SA** (`401361224018-compute@…`).

### live.html data base

| Context | `window.LIVE_DATA_BASE` |
|---------|-------------------------|
| Localhost (default) | `data/live/` (filesystem via `serve.py`) |
| Firebase / `?storage=gcs` on hosted site | `/data/live/` (Hosting rewrite → Run → GCS) |
| Override | `?liveDataBase=https://…/data/live/` or set `window.LIVE_DATA_BASE` before modules load |
| Local GCS smoke | `?storage=gcs` + `window.LIVE_DATA_CLOUD_RUN='https://live-ingest-….run.app/data/live/'` (needs `--public-data` deploy) |

## Production behaviour (locked)

- **No seed/backfill** in production — `--seed` is rejected with `--gcs`. Empty GCS bucket still writes **one latest data hour** only; days −1/−2/−3 accumulate naturally.
- **Hourly ongoing only** — same logic as local `scripts/hourly-ingest.mjs --live`.
- Local macOS cron + filesystem ingest are unchanged (`npm run cron:install`, `data/live/`).

**Note (Aug 2026):** First smoke `/run` on an empty bucket accidentally seeded before `hourlyOnly` was enforced. GCS may hold 2026-08-11…14 from that run; hourly Scheduler runs are ongoing-only from `index.json` onward. To start fresh: delete `gs://nhs-patient-records-live/live/*` and redeploy Run after the fix.

## Layout

| Path | Role |
|------|------|
| `cloud_run/server.mjs` | HTTP `/run`, `/health`, `/data/live/*.json` |
| `js/live-storage.js` | FS + GCS adapters |
| `scripts/hourly-ingest.mjs` | Shared ingest (`--gcs` for Cloud Run) |
| `scripts/deploy_live_ingest.sh` | One-shot deploy |
| `.firebaserc` / `firebase.json` | Hosting + `siteGate` rewrites; `/data/live/**` via function proxy |
| `functions/index.js` | `siteGate` — password gate (ports `middleware.js`) |
| `scripts/prepare_firebase_public.sh` | Copy static site → `public/` + `functions/hosting-pages/` |

## Smoke tests

```bash
SERVICE_URL="$(gcloud run services describe live-ingest --region=europe-west2 --format='value(status.url)')"
curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" "${SERVICE_URL}/health"
curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" "${SERVICE_URL}/data/live/index.json"
# Scheduler invokes GET /run with OIDC — do not run /run repeatedly in prod without reason
```

List objects:

```bash
gsutil ls gs://nhs-patient-records-live/live/
```

## Firebase Hosting + password auth

Static HTML/CSS/JS is copied to `public/`; HTML is also mirrored to `functions/hosting-pages/` for the gate function.

**Deploy status (Aug 2026):** **Full stack live** at https://nhs-patient-records.web.app — Firebase Hosting + **`siteGate`** (Cloud Functions v2, `europe-west2`) + Cloud Run `live-ingest` + Scheduler → GCS. HTML stays in `functions/hosting-pages/` (not ungated in `public/`) and is served only through `siteGate` after password login. Static CSS/JS/images served directly from Hosting.

Post-deploy smoke tests (no session cookie):

```bash
BASE=https://nhs-patient-records.web.app
curl -sS -o /dev/null -w '%{http_code}
' "$BASE/"                    # 401 + login form
curl -sS -o /dev/null -w '%{http_code}
' "$BASE/live.html"           # 401 + login form
curl -sS -o /dev/null -w '%{http_code}
' "$BASE/nhs-data-guide.html" # 401 + login form
curl -sS -o /dev/null -w '%{http_code}
' "$BASE/css/aq-widget.css"   # 200
curl -sS -o /dev/null -w '%{http_code}
' "$BASE/data/live/index.json" # 401 (not 404)
firebase functions:list --project nhs-patient-records                  # siteGate, europe-west2
```

Manual: log in with `SITE_PASSWORD` (same as Vercel), confirm `live.html` loads `/data/live/` JSON and inactivity logout.

### Build `public/`

```bash
chmod +x scripts/prepare_firebase_public.sh
./scripts/prepare_firebase_public.sh
# or: npm run prepare:firebase
```

Includes root `*.html`, `css/`, `js/`, `images/`. **Excludes** `data/live/` (live JSON comes from GCS via Cloud Run).

### Secret Manager — SITE_PASSWORD

Create manually (same value as Vercel `SITE_PASSWORD`; do not commit):

```bash
gcloud config set project nhs-patient-records

gcloud secrets create SITE_PASSWORD --replication-policy=automatic
echo -n 'YOUR_PASSWORD_HERE' | gcloud secrets versions add SITE_PASSWORD --data-file=-

PROJECT_NUMBER=401361224018
FUNCTIONS_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding SITE_PASSWORD \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

Firebase Functions v2 binds `SITE_PASSWORD` on deploy via `defineSecret` in `functions/index.js`.

### Auth model (`siteGate` function)

Ports [middleware.js](../middleware.js) exactly:

| Route | Behaviour |
|-------|-----------|
| `POST /__auth` | Form login → `__session` cookie (SHA-256 of `v1:password`, 30 min; Hosting only forwards this name to Cloud Run) |
| `POST /__activity` | Rolling cookie refresh (used by [js/inactivity-logout.js](../js/inactivity-logout.js)) |
| `GET /__logout` | Clear cookie → `/` |
| `GET /`, `GET /*.html` | Serve HTML from `functions/hosting-pages/` when cookie valid; else login form |
| `GET /data/live/**` | When cookie valid, proxy to Cloud Run with Functions SA identity token; else `401` JSON |

**Static assets** (`css/`, `js/`, `images/`) are served directly from Hosting without the gate (HTML and live JSON stay protected).

**Why `__session` (not `nhs_aq_gate`)?** Firebase Hosting strips all cookies except `__session` when rewriting to Cloud Run (including Functions v2). Vercel middleware keeps `nhs_aq_gate`; same hash and 30-minute rolling refresh. Proxying `/data/live/**` through `siteGate` keeps live JSON behind the same session as HTML.

Grant the Functions runtime SA **`roles/run.invoker`** on `live-ingest` (if not already):

```bash
gcloud run services add-iam-policy-binding live-ingest \
  --region=europe-west2 \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/run.invoker"
```

### Deploy Hosting + Functions

Prerequisite: **`SITE_PASSWORD` secret must exist** (gcloud steps above). If it is missing, `firebase deploy` prompts interactively or fails.

Set the active Firebase project if your CLI default is not `nhs-patient-records`:

```bash
firebase use nhs-patient-records
```

```bash
npm run prepare:firebase
cd functions && npm ci && cd ..
firebase deploy --only hosting,functions --project nhs-patient-records
# or: npm run deploy:firebase
```

First deploy requires Blaze billing and `firebase login`. After Functions deploy, grant `roles/run.invoker` on `live-ingest` to the Functions runtime SA (see above).

Preview URL: `https://nhs-patient-records.web.app` (or custom domain in Hosting settings).

See [ROADMAP.md](../ROADMAP.md#firebase-migration-production).

## CI — GitHub Actions

Workflow: [`.github/workflows/firebase-deploy-merge.yml`](../.github/workflows/firebase-deploy-merge.yml)

| Trigger | Action |
|---------|--------|
| Push to `main` | Deploy Hosting + `siteGate` (`firebase deploy --only hosting,functions --non-interactive`) |

Build steps mirror local `npm run deploy:firebase`: `npm run prepare:firebase` → `functions` `npm ci` → Firebase CLI deploy. Uses [`google-github-actions/auth`](https://github.com/google-github-actions/auth) with a service account JSON secret — **not** `FirebaseExtended/action-hosting-deploy` (hosting-only).

### GitHub secret — `FIREBASE_SERVICE_ACCOUNT_NHS_PATIENT_RECORDS`

1. [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=nhs-patient-records) → **Create service account** (e.g. `github-actions-firebase-deploy`).
2. Grant roles (Firebase Admin is simplest; or least-privilege bundle):
   - `roles/firebase.admin`, **or**
   - `roles/firebasehosting.admin` + `roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser` + `roles/secretmanager.secretAccessor` (required for `defineSecret("SITE_PASSWORD")` on deploy).
3. **Keys** → **Add key** → **JSON** → download.
4. GitHub repo → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Name: `FIREBASE_SERVICE_ACCOUNT_NHS_PATIENT_RECORDS`
   - Value: paste the entire JSON file contents.

**Do not** put `SITE_PASSWORD` in GitHub — it must already exist in [Secret Manager](#secret-manager--site_password) before CI deploy succeeds.

### Out of scope for this workflow

- **Cloud Run `live-ingest`** + Scheduler — deploy with `./scripts/deploy_live_ingest.sh` / `npm run deploy:live-ingest` when ingest code or infra changes.
- **Vercel** — separate deploy on push to `main` (parallel until cutover).
