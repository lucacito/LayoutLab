#!/usr/bin/env bash
# One allowlisted `bash …` command that patches a published layout locally.
# Usage: bash scripts/fix-live-layout.sh <slug> [logfile]
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?usage: fix-live-layout.sh <slug> [logfile] [prod]}"
LOG="${2:-}"
set -a; . ./.env.local; set +a
# 3rd arg "prod" → read+update the prod (Neon) row directly (for layouts that
# only exist on prod). Otherwise operate on the local row.
if [ "${3:-}" = "prod" ]; then
  TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
  export TARGET_DB_URL
  echo "[fix] targeting PROD db"
fi
if [ -n "$LOG" ]; then
  npx tsx scripts/patch-live-layout.ts "$SLUG" >"$LOG" 2>&1
  echo "EXIT=$? (log: $LOG)"
else
  npx tsx scripts/patch-live-layout.ts "$SLUG"
fi
