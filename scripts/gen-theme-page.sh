#!/usr/bin/env bash
# Wrapper so theme-page generation runs as ONE allowlisted `bash …` command
# (avoids per-subcommand permission prompts for `.`/`:`/env-prefixed invocations).
#
# Usage:  bash scripts/gen-theme-page.sh <role[,role2,…]> [logfile]
#   e.g.  bash scripts/gen-theme-page.sh about
#         bash scripts/gen-theme-page.sh reservations /tmp/gen.log
#
# Sources .env.local (VALIDATOR_CMD, PIPELINE_MAX_BUDGET_USD, DB/BLOB/PEXELS/INGEST),
# sets THEME_ONLY_ROLES, and runs the restaurant pack generator. Does NOT pass a
# model (inherits the current Claude CLI model — leave it alone on purpose).
set -euo pipefail
cd "$(dirname "$0")/.."

ROLES="${1:?usage: gen-theme-page.sh <role[,role2]> [logfile]}"
LOG="${2:-}"

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

export THEME_ONLY_ROLES="$ROLES"

if [ -n "$LOG" ]; then
  npx tsx scripts/create-restaurant-pack.ts >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/create-restaurant-pack.ts
fi
