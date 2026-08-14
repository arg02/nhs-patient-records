#!/bin/bash
# Live Today calc — hourly Exposure API ingest
# Writes data/live/{YYYY-MM-DD}.json + data/live/index.json for live.html
#
# Cron example (5 minutes past every hour — after GMT hour rolls, nowcast lag is floor−2h):
# 5 * * * * /path/to/scripts/run_live_hourly.sh

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
mkdir -p logs

LOG_FILE="logs/live_hourly_$(date +%Y-%m-%d).log"

echo "========================================" >> "$LOG_FILE"
echo "Live Today ingest - $(date)" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Load EXPOSURE_API_KEY from .env if present (cron has no shell profile)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -z "${EXPOSURE_API_KEY:-}" ]; then
  echo "ERROR: EXPOSURE_API_KEY not set (check .env)" >> "$LOG_FILE"
  exit 1
fi

node scripts/hourly-ingest.mjs --live >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Completed successfully at $(date)" >> "$LOG_FILE"
else
  echo "ERROR: Failed with exit code $EXIT_CODE at $(date)" >> "$LOG_FILE"
fi

echo "" >> "$LOG_FILE"
exit $EXIT_CODE
