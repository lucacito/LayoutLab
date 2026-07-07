#!/usr/bin/env bash
# Canonicalize every (415) phone number on each page to the brandFacts number,
# then push the new assets/refs to prod. Patches the LOCAL row, then copies refs
# to prod. Runs pages sequentially (single render env).
# Usage: bash scripts/fix-phones.sh <slug> [slug2 ...]
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$#" -ge 1 ] || { echo "usage: fix-phones.sh <slug> [slug2 ...]"; exit 1; }
set -a; . ./.env.local; set +a
PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
export PROD_DATABASE_URL
for SLUG in "$@"; do
  echo "=== [phones] $SLUG ==="
  PATCH_MODE=phone npx tsx scripts/patch-live-layout.ts "$SLUG"
  npx tsx scripts/apply-prod-refs.ts "$SLUG"
done
echo "[phones] all done"
