# Roadmap

Open work for the air quality patient-record prototypes. Not a commitment schedule — a reminder of direction and open questions.

---

## Research & clinical framing

### Relative risk (RR) / concentration–response functions

**Status:** Open — needs follow-up design decision.

Epidemiology and WHO/COMEAP health-risk methods express long-term mortality/morbidity associations as **relative risk (or CRF) per µg/m³** (typically per 10 µg/m³), not as multipliers of the WHO guideline. “× WHO” is a useful exceedance signal, but it is **not** the unit used in concentration–response evidence.

**Implications to explore:**

1. Whether the Long-term panel should **lead with µg/m³** (and/or absolute excess above WHO) rather than, or ahead of, “3.6×”-style multipliers.
2. How (if at all) population-level RR / CRF numbers can appear as **clinical guidance** in the footer without overstating individual risk.
3. Pollutant-specific differentials (e.g. WHO/COMEAP PM₂.₅ RR ≈ 1.08 per 10 µg/m³) and caveats: linearity, co-pollutant mixture, population vs individual absolute risk.

**Sources already reviewed (Jul 2026):**

- WHO Global Air Quality Guidelines (2021) — CRFs per unit concentration
- Chen & Hoek meta-analysis (PM₂.₅ mortality) underpinning AQG update
- COMEAP quantification recommendations / PM₂.₅ CRF statements
- GBD integrated exposure–response (µg/m³-based, often non-linear)
- NICE QS181 / DAQI — short-term clinical advice already aligns with Recent/Forecast bands

**Prototype hook:** `HEALTH_ADVICE.longTerm` in [`js/air-quality.js`](js/air-quality.js) is still a placeholder for long-term clinical copy.

### Short-term hourly NO₂ / asthma admissions (Birmingham–Solihull)

**Source (Aug 2026):** Shukla et al., BMJ Open 16:e110612 — [doi:10.1136/bmjopen-2025-110612](https://doi.org/10.1136/bmjopen-2025-110612). Full PDF reviewed locally (CC BY).

**Headline findings:** time-series of **18 943** adult (≥16) acute asthma admissions at four Birmingham–Solihull hospitals (Jun 2016–May 2022); Poisson GAM + DLNM on **hourly NO₂** vs hourly admissions; mean NO₂ **18 µg/m³** over lag **0–24 h** → **RR 1.13** (95% CI 1.01–1.26) for **daytime** admissions vs **no exposure**; **RR 1.11** (1.01–1.23) **per +10 µg/m³**; significant association at lag **3–6 h**; stronger in most deprived areas. Authors’ framing: high-temporal resolution for **healthcare preparedness / resource allocation**, not individual prediction.

**Product design takeaways (not locked):**

1. **3.2f hourly Today** is justified as an **optional NO₂ context strip**, not a replacement for the single Today ladder (latest-hour NO₂ / PM·O₃ triggers stay normative).
2. Lag tint is **NO₂-specific**; overall-max DAQI hours can misattribute PM/O₃ peaks.
3. Paper contrast is absolute mean vs **zero**, not “rising” — avoid rise-implies-admissions messaging; 18 µg/m³ is still **DAQI Low** (NO₂ Moderate ≥68) so this paper does **not** redefine DEFRA Moderate+ action bands.
4. Footer: population association / preparedness language; no personal admission risk %; keep DAQI advice as DEFRA bands.
5. No change implied for Recent (−3/−2/−1) or Forecast from this paper alone.

**Next prototype experiments:** compact Today + expandable hourly NO₂; tint only when lag-window hours exceed a stated absolute µg/m³ (not any uptick); µg/m³ tooltips beside DAQI; Low-band (~40–60) commute peak mock alongside Moderate peak.

---

## Product / design

| Item | Status |
|------|--------|
| Restructure [nhs-data-guide.html](nhs-data-guide.html) into Annual / Previous days / Today / Forecast with end-product mockups | **Done** (Jul 2026) — deploy via Vercel only |
| Keep GitHub Pages unpublished (proprietary trigger table) | **Policy** — Vercel password gate is the public host; remind if asked to push to Pages |
| Promote a 3.2 variant to the main showcase | Open |
| Wire prototype to live exposure API (replace mock) | Open — rules are in the data guide |
| Prototype still simplifies some Today / pollutant-specific paths vs the guide | Open — keep guide normative; align JS when integrating |
| Explore hourly Today panel (3.2f) — lag-sensitive short-term view | **Prototype** (Aug 2026) — dotted lag outline under hours; full-width row above Long-term \| Recent \| Forecast |
| **Live Today calculation page** | **Local works** — `data/live/{YYYY-MM-DD}.json` (today+−1/−2/−3, `_old/` archive); seed once then latest data hour only (wall−2, GMT→UK). Forecast from London Air **Future** on each cron run (`index.json`). Panels show data hour + µg/m³ charts. Firebase still for production cron. |
| Local hourly cron | **Done** — crontab `:05` → `scripts/run_live_hourly.sh` (same pattern as aq-model-testing nowcast effect). Install: `npm run cron:install`. Serve separately. |
| Hourly cron + previous-hour / trigger storage (production) | **Deployed** — Cloud Run `live-ingest-00003-snp` + Scheduler `:05` → GCS. `GET /data/live/*.json` on same service; `live.html` uses `window.LIVE_DATA_BASE`. |
| **Firebase Hosting (full stack)** | **Deployed** — https://nhs-patient-records.web.app · `siteGate` v2 (`europe-west2`, `SITE_PASSWORD` secret) gates `*.html` and `/data/live/**`; CSS/JS static. Deploy: `npm run prepare:firebase` + `npm run deploy:firebase`. Parallel with Vercel until cutover. |

---

## Firebase migration (production)

**Direction (Aug 2026):** GCP project **`nhs-patient-records`** (#401361224018). Hourly ingest on **Cloud Run** (not Cloud Functions) in **`europe-west2`**; **Cloud Scheduler** `5 * * * *` **Europe/London** → `GET /run`. Output: **Cloud Storage** `gs://nhs-patient-records-live/live/*.json` (mirrors local `data/live/`). **No production seed/backfill** — days −1/−2/−3 accumulate over calendar days. **Firebase Hosting + `siteGate`** deployed at https://nhs-patient-records.web.app (parallel with Vercel until cutover).

**Deploy / ops:** [docs/FIREBASE_LIVE_INGEST.md](docs/FIREBASE_LIVE_INGEST.md) · `./scripts/deploy_live_ingest.sh` · `npm run deploy:live-ingest`

### Reference repos

**Vault check (Aug 2026):** No project in `~/Sites/global` has all three (Hosting + Cloud Functions + Cloud Scheduler) together. Migration is a **composite** from:

| Need | Project | Path | What it has |
|------|---------|------|-------------|
| Hosting + GitHub Actions CI | **nhs-patient-records** | `~/Sites/nhs-patient-records` | Hosting + Functions — `firebase-deploy-merge.yml` (not hosting-only) |
| Hosting + static `public/` prep | **aq-model-testing** | `~/Sites/aq-model-testing` | Hosting (**https://aq-model-analysis.web.app**) + **Cloud Scheduler** + **Cloud Run** ingest — `prepare_firebase_public.sh`, `docs/FIREBASE_HOSTING.md`, `cloud_run_google/README.md` |
| Password gate on Firebase | **ecoquity-tech** | `~/Volumes/Sabrent Rocket XTRM/Sites/ecoquity-tech` | Hosting (**https://ecoquity.tech**) + **Cloud Functions** (`architectureApi`, session cookie via rewrites) — **no Scheduler** |
| Local hourly cron (dev) | **nhs-patient-records** | this repo | `scripts/run_live_hourly.sh` — see `~/Sites/global/patterns/local-crontab-json-ingest.md` |
| Ingest logic (source of truth) | **nhs-patient-records** | this repo | `scripts/hourly-ingest.mjs`, `js/today-calc.js`, `js/live-store.js`, `js/london-air-forecast.js` |

**Adapt from aq-model-testing:** Cloud Run + Scheduler in **`europe-west2`**; schedule **`5 * * * *` Europe/London** (this repo’s ingest cadence, not aq-model-testing’s `:55` UTC).

**daqi-vs-caqi caveat:** SPA rewrite (`** → /index.html`) — **do not copy**; this repo is multi-page static HTML.

### Target architecture

```
Cloud Scheduler (5 * * * *, Europe/London)
  → live-ingest (Cloud Run, europe-west2) GET /run
  → gs://nhs-patient-records-live/live/{date}.json + index.json (+ _old/)
Firebase Hosting (static HTML/CSS/JS from public/) — siteGate auth
  → rewrites /__auth, /__activity, /__logout, /*.html, /data/live/** → siteGate
  → siteGate proxies /data/live/** → live-ingest (Cloud Run) when session cookie valid
Secret Manager: EXPOSURE_API_KEY, SITE_PASSWORD
```

- **Live state:** Cloud Storage — mirrors current JSON paths; Firestore optional later.
- **Region:** `europe-west2` (same as Exposure API).
- **Password gate mandatory** before sharing any Firebase URL — `nhs-data-guide.html` has proprietary ERG triggers (same policy as no GitHub Pages).

### Phased checklist

1. **Init** — Firebase project `nhs-patient-records`, `.firebaserc`, Secret Manager `EXPOSURE_API_KEY`. **Done (scaffold).**
2. **Ingest** — Cloud Run + GCS + Scheduler. **Deployed** — `./scripts/deploy_live_ingest.sh` / `npm run deploy:live-ingest`.
3. **Hosting** — `scripts/prepare_firebase_public.sh` copies `*.html`, `css/`, `js/`, `images/` to `public/` (not `data/live/`). **Done (scaffold).**
4. **Auth** — `siteGate` function ports `middleware.js` cookie logic; `inactivity-logout.js` unchanged. **Deployed** (`npm run deploy:firebase`, Aug 2026).
5. **CI** — GitHub Actions on `main` → `.github/workflows/firebase-deploy-merge.yml` (Hosting + `siteGate`). **Done (Aug 2026)** — add `FIREBASE_SERVICE_ACCOUNT_NHS_PATIENT_RECORDS` secret to enable.
6. **Cutover** — parallel Vercel + Firebase, then retire Vercel middleware.

**Fastest cron-only path:** Phase 2 on GCP while Vercel still hosts static + auth; sync or proxy `/data/live/**` from Storage.

---

## Project documentation

| Doc | Status |
|-----|--------|
| [README.md](README.md) | Exists — pages, concepts, maths, hosting, structure |
| [AGENTS.md](AGENTS.md) | Exists — agent workflow, invariants, “update docs after meaningful work” |
| [ROADMAP.md](ROADMAP.md) | This file |
| [nhs-data-guide.html](nhs-data-guide.html) | Exists — NHS integration (four-section layout) |
| Spec / design-decision log | Still thin — key decisions live in README; expand if decisions proliferate |
