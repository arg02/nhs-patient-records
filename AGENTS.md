# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## What this project is

Static HTML/CSS/JS prototypes for an NHS Cerner-style air quality widget (Long-term WHO · Recent DAQI · Forecast). Design iteration first; live clinical integration is documented separately for NHS implementers.

**Primary integration doc:** [nhs-data-guide.html](nhs-data-guide.html) — four sections (Annual · Previous days · Today · Forecast) with end-product mockups.

**Human overview:** [README.md](README.md)  
**Open work:** [ROADMAP.md](ROADMAP.md)

## Hosting

- **Production:** https://nhs-patient-records.web.app — **Firebase Hosting** + **`siteGate` Cloud Function** v2 (`europe-west2`, `SITE_PASSWORD` in Secret Manager) + **Cloud Run** (`live-ingest`) + **Cloud Scheduler** (`5 * * * *` Europe/London) → GCS `gs://nhs-patient-records-live/live/*.json`. GCP project **`nhs-patient-records`** (#401361224018). Build: `npm run prepare:firebase`; deploy: `npm run deploy:firebase` or push to `main` (GitHub Actions `.github/workflows/firebase-deploy-merge.yml` after `FIREBASE_SERVICE_ACCOUNT_NHS_PATIENT_RECORDS` secret) — see [docs/FIREBASE_LIVE_INGEST.md](docs/FIREBASE_LIVE_INGEST.md). Cloud Run ingest: `./scripts/deploy_live_ingest.sh` (separate from Hosting CI).
- **Vercel removed (Aug 2026)** — was the previous host; all production traffic is Firebase only.
- **GitHub Pages stays OFF.** The NHS data guide includes proprietary ERG index-point triggers; a public Pages site would expose them without a password.
- If the user asks to “push to GitHub Pages”, **remind them Pages is off for that reason**, then push to `main` so **Firebase CI** deploys (unless they explicitly insist on re-enabling Pages).
- Local preview: `python3 serve.py 8080` (or `8765`) — no password gate. `js/inactivity-logout.js` is a no-op on localhost / 127.0.0.1 (it must not redirect to `/__logout`); `serve.py` also no-ops `/__logout` and `/__activity`.

## After meaningful work — update docs in the same task

Do **not** wait to be asked. When you finish a new feature, lock a product/data decision, or change deploy/auth behaviour, update the relevant docs **in the same turn**:

| Change type | Update |
|-------------|--------|
| Pages, concepts, data sources, deploy | [README.md](README.md) |
| Open research, next steps, doc gaps | [ROADMAP.md](ROADMAP.md) |
| Agent workflow, invariants, “where is X” | This file (`AGENTS.md`) |
| NHS calculation / API rules | [nhs-data-guide.html](nhs-data-guide.html) |

Keep README factual; put unresolved research on the roadmap; keep AGENTS short and actionable.

Also update `~/Sites/global/projects/nhs-patient-records.md` (and a `learnings/` note when the session was decision-heavy). If the user asks to “push to GitHub Pages,” remind them Pages stays off and deploy via Firebase instead.

## Hard invariants

1. **WHO annual ≠ DAQI daily** — keep long-term WHO maths and DAQI index levels on separate scales.
2. **Past days (−3/−2/−1)** — completed UK-local day stats only; triggers are for Today.
3. **Today** — current situation: NO₂ = latest hour; PM/O₃ = ERG index-point triggers (persist until superseded / cleared). Band anchors = DEFRA 2013; per-index table = ERG proprietary. In NHS-facing docs, omit any Awair reference (separate project).
4. **Tone (NHS-facing copy)** — prefer positive / descriptive phrasing over “do not” / “never” imperatives (reads as aggressive in UK English).
5. **Rounding** — once, last step before DAQI compare; project convention `.5` → up (`Math.floor(value + 0.5)`).
6. **UK calendar days** — group with `Europe/London` (BST-aware); timestamps are GMT hour-start.
7. **Commits / push** — only when the user asks. Prefer local preview before Firebase push when they say so.
8. **No GitHub Pages** — stay unpublished; Firebase is the host. Remind the user if they ask for Pages.

## Where to look

| Need | Location |
|------|----------|
| DAQI thresholds, colours, mock patient | `js/air-quality.js` |
| Ladder / widget factories | `js/widget-render.js`, `js/stack-widget.js` |
| Hourly Today exploration (3.2f) | `concept32.html#design-3-2f`, `todayHourlyPrototypeSeries` / `todayHourlyCardHtml`; layout: hourly row above Long-term \| Recent \| Forecast |
| Live Today calc (3.2b + explainers) | `live.html`, `js/live-demo.js`, `js/live-storage.js`, … — local default `data/live/`; hosted/`?storage=gcs` → `/data/live/` (see `window.LIVE_DATA_BASE` in `live.html`) |
| Production live ingest (GCP) | `cloud_run/server.mjs` — `/run`, `/health`, `/data/live/*.json`; [docs/FIREBASE_LIVE_INGEST.md](docs/FIREBASE_LIVE_INGEST.md) |
| Local hourly cron (optional dev) | **Production:** Cloud Scheduler → Cloud Run (no Mac crontab). **Localhost:** `run_live_hourly.sh` + `setup_live_hourly_cron.sh` (`npm run cron:install` / `cron:remove`); logs in `logs/`; keep `npm run serve` up separately |
| Styles | `css/aq-widget.css`, `css/site-nav.css` |
| Password / logout / activity | `functions/index.js` (`siteGate`, cookie `__session` — Hosting only forwards that name to Functions), `js/inactivity-logout.js` |
| Firebase CI | `.github/workflows/firebase-deploy-merge.yml` — secret `FIREBASE_SERVICE_ACCOUNT_NHS_PATIENT_RECORDS` |
| Fill / threshold tests | `scripts/verify-fill-logic.mjs` |

## Design preference

When editing prototypes, preserve the established Cerner-adjacent widget language (panels, DAQI ladders, WHO bars). Prefer Design **3.2a/3.2b** as the current visual direction unless the user specifies otherwise.
