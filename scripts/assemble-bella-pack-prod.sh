#!/usr/bin/env bash
# Assemble the Bella Nota pack on PROD with a LIVE Stripe price.
# Usage: bash scripts/assemble-bella-pack-prod.sh            (dry-run)
#        bash scripts/assemble-bella-pack-prod.sh --confirm  (writes prod + mints price)
set -euo pipefail
cd "$(dirname "$0")/.."
# Prod live env: .env.prod has the live sk_live_ key; its POSTGRES_URL is empty so
# use DATABASE_URL (pooled Neon) as the prod connection.
export STRIPE_SECRET_KEY="$(grep '^STRIPE_SECRET_KEY=' .env.prod | cut -d= -f2- | tr -d '"')"
export PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
npx tsx scripts/assemble-bella-pack-prod.ts "${1:-}"
