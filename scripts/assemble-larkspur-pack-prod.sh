#!/usr/bin/env bash
# Assemble the Larkspur pack on PROD as a FREE pack (no Stripe).
# Usage: bash scripts/assemble-bella-pack-prod.sh            (dry-run)
#        bash scripts/assemble-bella-pack-prod.sh --confirm  (writes prod + mints price)
set -euo pipefail
cd "$(dirname "$0")/.."
# Prod live env: .env.prod has the live sk_live_ key; its POSTGRES_URL is empty so
# use DATABASE_URL (pooled Neon) as the prod connection.
export PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
npx tsx scripts/assemble-larkspur-pack-prod.ts "${1:-}"
