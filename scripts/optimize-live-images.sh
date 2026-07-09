#!/usr/bin/env bash
# Backfill existing PNG screenshots to optimized WebP and repoint DB rows.
# Usage: bash scripts/optimize-live-images.sh [prod] [--confirm]
#   (no args)          dry-run against the local db
#   --confirm          convert + upload + update local rows
#   prod --confirm     convert + upload + update PROD (Neon) rows
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
ARGS=()
for a in "$@"; do
  if [ "$a" = "prod" ]; then
    TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
    export TARGET_DB_URL
    echo "[optimize] targeting PROD db"
  else
    ARGS+=("$a")
  fi
done
npx tsx scripts/optimize-live-images.ts "${ARGS[@]:-}"
