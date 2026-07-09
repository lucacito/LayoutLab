#!/usr/bin/env bash
# Copy locally-generated layout SEO articles to matching prod rows by slug.
# Usage: bash scripts/copy-seo-articles-to-prod.sh [--confirm]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
export TARGET_DB_URL
npx tsx scripts/copy-seo-articles-to-prod.ts "$@"
