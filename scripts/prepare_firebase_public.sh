#!/usr/bin/env bash
# Populate public/ for Firebase Hosting and mirror HTML for the siteGate function.
# Run from repo root: ./scripts/prepare_firebase_public.sh
# Then: firebase deploy --only hosting,functions
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf public
mkdir -p public functions/hosting-pages

# HTML → siteGate only (functions/hosting-pages/). Do NOT copy to public/:
# when siteGate is missing, Hosting falls through to static files and would expose gated pages.
shopt -s nullglob
for f in *.html; do
  cp "$f" functions/hosting-pages/
done
shopt -u nullglob

cp -r css js images public/

cat > public/README.md <<'EOF'
# Firebase Hosting output (generated)

Built by `scripts/prepare_firebase_public.sh`. Do not edit by hand.

- Static assets (`css/`, `js/`, `images/`) are served directly from Hosting.
- `*.html` lives only in `functions/hosting-pages/` — served by `siteGate` after Functions deploy.
- Live JSON is **not** here — browser fetches `/data/live/**` (siteGate → Cloud Run → GCS).
EOF

echo "Done. public/ is ready for Firebase Hosting."
echo "HTML mirrored to functions/hosting-pages/ for siteGate."
find public -type f | wc -l | xargs echo "public file count:"
ls -la public/
