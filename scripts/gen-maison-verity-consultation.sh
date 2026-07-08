#!/usr/bin/env bash
# Generate the Maison Verity "Request a Private Consultation" page (one contact-flow layout).
# Usage: bash scripts/gen-maison-verity-consultation.sh [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
LOG="${1:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npx tsx scripts/create-maison-verity-consultation.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-maison-verity-consultation.ts
fi
