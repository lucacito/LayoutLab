#!/usr/bin/env bash
# Generate a big, diverse batch of FREE sections via the matrix pipeline's `vary`
# mode (many variants per type across niche/style/color/layout; content-hash dedupe
# prevents exact repeats). Runs until the targets are done OR the usage window is
# spent (429s then fail-fast to the end). Ingests locally (auto-approve).
# Usage: bash scripts/gen-sections-batch.sh <types-csv> <count-per-type> [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
TYPES="${1:?usage: gen-sections-batch.sh <types-csv> <count> [log]}"
COUNT="${2:?count required}"
LOG="${3:-}"
set -a; . ./.env.local; set +a
if [ -n "$LOG" ]; then
  npm run pipeline -- vary --type="$TYPES" --count="$COUNT" >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npm run pipeline -- vary --type="$TYPES" --count="$COUNT"
fi
