#!/usr/bin/env bash
# Generate the Ember & Steel bold steakhouse landing page (one full_landing layout).
# Usage: bash scripts/gen-steakhouse-landing.sh [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npx tsx scripts/create-steakhouse-landing.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-steakhouse-landing.ts
fi
