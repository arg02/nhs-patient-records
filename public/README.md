# Firebase Hosting output (generated)

Built by `scripts/prepare_firebase_public.sh`. Do not edit by hand.

- Static assets (`css/`, `js/`, `images/`) are served directly from Hosting.
- `*.html` lives only in `functions/hosting-pages/` — served by `siteGate` after Functions deploy.
- Live JSON is **not** here — browser fetches `/data/live/**` (siteGate → Cloud Run → GCS).
