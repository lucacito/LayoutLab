#!/usr/bin/env bash
# Publish the Bureau of Bad Ideas free pack to PROD straight through the production database.
# Usage: bash scripts/publish-bureau-prod.sh            (dry run)
#        bash scripts/publish-bureau-prod.sh --confirm  (writes prod)
# Needs: the local dev database up (docker compose up -d db) and a REAL
# DATABASE_URL_UNPOOLED in .env.prod (copy it from the Neon console; Vercel pulls only give
# a placeholder for secrets).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
export PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
npx tsx scripts/publish-bureau-prod.ts "${1:-}"
