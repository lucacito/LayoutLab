#!/usr/bin/env bash
# Apply the generic center-buttons patch (PATCH_MODE=center-buttons in
# patch-live-layout.ts) to one or more PUBLISHED prod layouts, sequentially:
# fetch JSON → patch → validate → re-render → upload new-hash assets → update
# the prod (Neon) row. Logs per slug under pipeline/out/btnfix/.
# Usage: bash scripts/fix-buttons.sh [--lone] <slug> [<slug>...]
#   --lone → pass 2 (PATCH_MODE=center-lone-buttons): lone-button columns in
#            centered sections (grid + bottom CTA shape missed by pass 1).
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
export TARGET_DB_URL
export PATCH_MODE=center-buttons
if [ "${1:-}" = "--lone" ]; then PATCH_MODE=center-lone-buttons; shift; fi
# --labels → button-font textAlign only (no column changes; safe for button pairs)
if [ "${1:-}" = "--labels" ]; then PATCH_MODE=center-labels; shift; fi
mkdir -p pipeline/out/btnfix
FAILED=0
for SLUG in "$@"; do
  echo "=== $SLUG ==="
  if npx tsx scripts/patch-live-layout.ts "$SLUG" >"pipeline/out/btnfix/$SLUG.log" 2>&1; then
    grep -E 'validator:|desktop preview:' "pipeline/out/btnfix/$SLUG.log"
  else
    FAILED=$((FAILED+1))
    echo "FAILED — last lines of pipeline/out/btnfix/$SLUG.log:"
    tail -5 "pipeline/out/btnfix/$SLUG.log"
  fi
done
echo "done ($FAILED failed)"
