#!/usr/bin/env bash
# Generate ONE section for an explicit target, optionally with library few-shot
# exemplars. Usage: bash scripts/gen-one.sh <type:niche:style> [use_library 0|1] [log]
set -euo pipefail
cd "$(dirname "$0")/.."
TARGET="${1:?usage: gen-one.sh <type:niche:style> [use_library 0|1] [log]}"
USE="${2:-0}"
LOG="${3:-}"
set -a; . ./.env.local; set +a
export USE_LIBRARY_EXEMPLARS="$USE"
if [ -n "$LOG" ]; then
  npm run pipeline -- one --target="$TARGET" >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npm run pipeline -- one --target="$TARGET"
fi
