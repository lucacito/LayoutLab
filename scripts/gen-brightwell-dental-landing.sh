#!/usr/bin/env bash
# Generate the Brightwell Family Dental fresh-clean family dentistry landing page (one full_landing layout).
# Usage: bash scripts/gen-brightwell-dental-landing.sh [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npx tsx scripts/create-brightwell-dental-landing.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-brightwell-dental-landing.ts
fi
