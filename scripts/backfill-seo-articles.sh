#!/usr/bin/env bash
# Backfill long-form SEO articles into layouts.seo (see backfill-seo-articles.ts).
# Usage: bash scripts/backfill-seo-articles.sh [prod] [--confirm] [--limit=N] [--slug=x] [--force]
#   (no args)          dry-run against the local db (lists targets)
#   --confirm          generate + write local rows
#   prod --confirm     generate + write PROD (Neon) rows
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
ARGS=()
for a in "$@"; do
  if [ "$a" = "prod" ]; then
    TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
    export TARGET_DB_URL
    echo "[seo-articles] targeting PROD db"
  else
    ARGS+=("$a")
  fi
done
npx tsx scripts/backfill-seo-articles.ts "${ARGS[@]:-}"
