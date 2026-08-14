#!/bin/bash
# Install / remove crontab entry for Live Today hourly ingest
# Mirror of aq-model-testing/scripts/setup_nowcast_effect_hourly_cron.sh
#
# Usage:
#   ./scripts/setup_live_hourly_cron.sh          # interactive
#   ./scripts/setup_live_hourly_cron.sh --yes     # install without prompt
#   ./scripts/setup_live_hourly_cron.sh --remove  # remove only

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COLLECTION_SCRIPT="$SCRIPT_DIR/run_live_hourly.sh"
CRON_LINE="5 * * * * $COLLECTION_SCRIPT"

YES=0
REMOVE=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --remove) REMOVE=1 ;;
  esac
done

chmod +x "$COLLECTION_SCRIPT"

echo "NHS Live Today — hourly cron setup"
echo "=================================="
echo ""
echo "Script: $COLLECTION_SCRIPT"
echo "Schedule: :05 every hour"
echo ""

existing="$(crontab -l 2>/dev/null | grep -F "$COLLECTION_SCRIPT" || true)"

if [ "$REMOVE" -eq 1 ]; then
  if [ -n "$existing" ]; then
    crontab -l 2>/dev/null | grep -v -F "$COLLECTION_SCRIPT" | crontab -
    echo "Removed cron job."
  else
    echo "No matching cron job found."
  fi
  exit 0
fi

if [ -n "$existing" ]; then
  echo "Cron job already exists:"
  echo "$existing"
  echo ""
  if [ "$YES" -eq 0 ]; then
    read -r -p "Remove and re-add? (y/n) " REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "Exiting."
      exit 0
    fi
  fi
  crontab -l 2>/dev/null | grep -v -F "$COLLECTION_SCRIPT" | crontab -
  echo "Removed existing job."
fi

(crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -

echo "Cron job added:"
echo "  $CRON_LINE"
echo ""
echo "View:   crontab -l"
echo "Remove: ./scripts/setup_live_hourly_cron.sh --remove"
echo "Logs:   $(dirname "$SCRIPT_DIR")/logs/live_hourly_YYYY-MM-DD.log"
echo ""
echo "Keep the site up separately:  npm run serve   (or python3 serve.py 8080)"
echo "Then open: http://127.0.0.1:8080/live.html"
