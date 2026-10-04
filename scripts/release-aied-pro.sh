#!/usr/bin/env bash
#
# Publish JHMG AI Editor for Divi 5 Pro (the separate paid add-on) to the divi5lab.com store.
# Uploads the zip to Vercel Blob and inserts a plugin_releases row in the PROD DB. Shipping an update never
# requires a Vercel redeploy. Idempotent: plugin_releases is unique on (product_slug, version).
#
# The zip comes from the add-on repo's `make build-pro` (dist/jhmg-ai-editor-for-divi-5-pro.zip). The paid zip is only ever
# served by the key-authenticated /api/plugin/download route; the old /api/plugin/free-download route serves nothing.
#
# Usage:
#   bash scripts/release-aied-pro.sh            # dry run: checks everything, publishes nothing
#   bash scripts/release-aied-pro.sh --confirm  # actually publishes
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PRODUCT="ai-editor-divi5-pro"
ZIP="${ZIP:-/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/dist/jhmg-ai-editor-for-divi-5-pro.zip}"
CONFIRM="${1:-}"

if [ ! -f .env.prod ]; then echo "ERROR: .env.prod not found" >&2; exit 1; fi
if [ ! -f "$ZIP" ]; then echo "ERROR: zip not found at $ZIP (run: make build-pro in the add-on repo)" >&2; exit 1; fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
unzip -q "$ZIP" -d "$STAGE"
PLUGIN_DIR="$STAGE/jhmg-ai-editor-for-divi-5-pro"
MAIN="$PLUGIN_DIR/jhmg-ai-editor-for-divi-5-pro.php"
if [ ! -f "$MAIN" ]; then echo "ERROR: the zip does not contain jhmg-ai-editor-for-divi-5-pro/jhmg-ai-editor-for-divi-5-pro.php" >&2; exit 1; fi

# The store keys updates on the version the plugin reports about itself, so register exactly that.
VERSION="$(grep -E "define\( 'AIED_PRO_VERSION'" "$MAIN" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)"
HEADER_VERSION="$(grep -E "^ \* Version:" "$MAIN" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)"
if [ -z "$VERSION" ] || [ "$VERSION" != "$HEADER_VERSION" ]; then
  echo "ERROR: AIED_PRO_VERSION ($VERSION) and the plugin header ($HEADER_VERSION) disagree" >&2; exit 1
fi
# Never ship the free plugin or a licence server override by accident.
if grep -rq "AIED_PRO_API_BASE', 'http" "$PLUGIN_DIR"; then echo "ERROR: the zip hard-codes an API base override" >&2; exit 1; fi

extract() { grep "^$1=" .env.prod | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }
export BLOB_READ_WRITE_TOKEN="$(extract BLOB_READ_WRITE_TOKEN)"
export POSTGRES_URL="$(extract DATABASE_URL)"
if [ -z "$BLOB_READ_WRITE_TOKEN" ] || [ -z "$POSTGRES_URL" ]; then
  echo "ERROR: BLOB_READ_WRITE_TOKEN or DATABASE_URL is empty in .env.prod (vercel env pull --environment=production .env.prod)" >&2; exit 1
fi

echo "[release] product: $PRODUCT  version: $VERSION  zip: $ZIP"
echo "[release] db host: $(echo "$POSTGRES_URL" | sed -E 's#.*@([^/?]+).*#\1#')"
if ! npx tsx scripts/check-prod-db.ts; then echo "[release] aborted before uploading anything." >&2; exit 1; fi

CHANGELOG="${CHANGELOG:-Licence tiers: your plan, the sites you use and your renewal date show on the Pro tab. A clear message when a licence is already on all of its sites. One dismissible notice when a licence ends: everything keeps working, only updates and support stop.}"

if [ "$CONFIRM" != "--confirm" ]; then
  echo
  echo "DRY RUN: nothing published. Everything above checked out."
  echo "Re-run with --confirm to publish:  bash scripts/release-aied-pro.sh --confirm"
  exit 0
fi

echo "[release] Publishing $PRODUCT $VERSION to prod..."
npx tsx scripts/release-plugin.ts --product "$PRODUCT" --version "$VERSION" --dir "$PLUGIN_DIR" --changelog "$CHANGELOG"

echo "[release] Verifying the store serves it (an older version should be offered the update; the package URL is withheld without a key)..."
sleep 2
curl -s "https://divi5lab.com/api/plugin/update-check?product=${PRODUCT}&version=0.0.1"
echo
