#!/usr/bin/env bash
# Backfill long-form body copy into taxonomy_pages (see backfill-taxonomy-body.ts).
# Usage: bash scripts/backfill-taxonomy-body.sh [prod] [--confirm]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
ARGS=()
for a in "$@"; do
  if [ "$a" = "prod" ]; then
    TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
    export TARGET_DB_URL
    echo "[taxonomy-body] targeting PROD db"
  else
    ARGS+=("$a")
  fi
done
npx tsx scripts/backfill-taxonomy-body.ts "${ARGS[@]:-}"
