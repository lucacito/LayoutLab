#!/usr/bin/env bash
# Generate the Maison Verity "Residences — The Private Register" page (one gallery-led layout).
# Usage: bash scripts/gen-maison-verity-residences.sh [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npx tsx scripts/create-maison-verity-residences.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-maison-verity-residences.ts
fi
