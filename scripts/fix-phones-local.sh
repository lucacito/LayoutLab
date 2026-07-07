#!/usr/bin/env bash
# Canonicalize every (415) number on a LOCAL layout row to a given number (no prod
# push — for pages not yet on prod). Usage:
#   bash scripts/fix-phones-local.sh <slug> "(415) 555-0187"
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?usage: fix-phones-local.sh <slug> [canon-phone]}"
CANON="${2:-(415) 555-0148}"
set -a; . ./.env.local; set +a
CANON_PHONE="$CANON" PATCH_MODE=phone npx tsx scripts/patch-live-layout.ts "$SLUG"
