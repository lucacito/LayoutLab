#!/usr/bin/env bash
# Push an edited layout's new asset refs to the PROD (Neon) row by slug.
# Usage: bash scripts/push-fix-to-prod.sh <slug>
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?usage: push-fix-to-prod.sh <slug>}"
set -a; . ./.env.local; set +a                       # local db (source of new refs)
# Prod Neon direct connection (unpooled works with node-postgres Pool).
PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
export PROD_DATABASE_URL
npx tsx scripts/apply-prod-refs.ts "$SLUG"
