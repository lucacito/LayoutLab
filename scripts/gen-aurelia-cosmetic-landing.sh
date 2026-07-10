#!/usr/bin/env bash
# Generate the Aurelia Smile Studio dark-luxury cosmetic dentistry landing page (one full_landing layout).
# Usage: bash scripts/gen-aurelia-cosmetic-landing.sh [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npx tsx scripts/create-aurelia-cosmetic-landing.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-aurelia-cosmetic-landing.ts
fi
