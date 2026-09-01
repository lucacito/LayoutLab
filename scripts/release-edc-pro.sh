#!/usr/bin/env bash
#
# Publish JHMG Converter For Elementor to Divi 5 — Pro to the divi5lab.com store.
# Uploads the zip to Vercel Blob and inserts a plugin_releases row in the PROD
# DB. Shipping an update never requires a Vercel redeploy — divi5lab.com reads
# the new row immediately. Idempotent: plugin_releases is unique on
# (product_slug, version), so a re-run fails cleanly instead of duplicating.
#
# Usage:
#   bash scripts/release-edc-pro.sh            # dry run — checks everything, publishes nothing
#   bash scripts/release-edc-pro.sh --confirm  # actually publishes
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

VERSION="1.2.0"
PRODUCT="elementor-to-divi5-pro"
PLUGIN_DIR="/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi-pro"
CONFIRM="${1:-}"

if [ ! -f .env.prod ]; then echo "ERROR: .env.prod not found" >&2; exit 1; fi

# Refuse to publish a directory whose version does not match what we are
# registering. The store keys on the version string the plugin reports, so a
# mismatch means customers are either never offered the update or offered one
# that reports a different number once installed.
if [ ! -f "$PLUGIN_DIR/jhmg-converter-for-elementor-to-divi-pro.php" ]; then
  echo "ERROR: plugin not found at $PLUGIN_DIR" >&2; exit 1
fi
STAGED_VERSION="$(grep -E "EDCP_PLUGIN_VERSION" "$PLUGIN_DIR/jhmg-converter-for-elementor-to-divi-pro.php" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+" | head -1)"
if [ "$STAGED_VERSION" != "$VERSION" ]; then
  echo "ERROR: plugin dir is $STAGED_VERSION, expected $VERSION" >&2; exit 1
fi

# Extract only the vars we need. Do NOT `source .env.prod` wholesale — some
# Vercel-dumped values (e.g. VERCEL_GIT_COMMIT_MESSAGE) contain characters that
# break sourcing partway, silently leaving later vars unset.
extract() { grep "^$1=" .env.prod | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }
export BLOB_READ_WRITE_TOKEN="$(extract BLOB_READ_WRITE_TOKEN)"
# .env.prod ships POSTGRES_URL="" (blank); the real pooled Neon URL that
# @vercel/postgres needs is in DATABASE_URL (the -pooler endpoint).
export POSTGRES_URL="$(extract DATABASE_URL)"

if [ -z "$BLOB_READ_WRITE_TOKEN" ]; then
  echo "ERROR: BLOB_READ_WRITE_TOKEN is empty in .env.prod" >&2; exit 1
fi
if [ -z "$POSTGRES_URL" ]; then
  cat >&2 <<'EOF'
ERROR: DATABASE_URL is empty in .env.prod — the blob would upload but the
       plugin_releases row would go nowhere, and the release would look like it
       worked while divi5lab.com kept serving the old version.

  Re-pull production env first:
      vercel link                                        # if not already linked
      vercel env pull --environment=production .env.prod

  Then re-run this script.
EOF
  exit 1
fi

echo "[release] env loaded (POSTGRES_URL host: $(echo "$POSTGRES_URL" | sed -E 's#.*@([^/?]+).*#\1#'))"
echo "[release] product: $PRODUCT  version: $VERSION  dir: $PLUGIN_DIR"

CHANGELOG='Theme Builder headers and footers now update in place instead of stacking duplicate layouts and default templates on every re-import. Requires Divi 5.0 or newer — the converter now checks and explains itself instead of writing pages that render blank. Global colours and fonts are read from your own Elementor kit, including typography, and an unresolved global is reported rather than replaced with a built-in value. Nested accordion and nested tabs are supported. Pro admin screens are styled. Translation template included.'

if [ "$CONFIRM" != "--confirm" ]; then
  echo
  echo "DRY RUN — nothing published. Everything above checked out."
  echo "Re-run with --confirm to publish:"
  echo "    bash scripts/release-edc-pro.sh --confirm"
  exit 0
fi

echo "[release] Publishing $PRODUCT $VERSION to prod..."
npx tsx scripts/release-plugin.ts \
  --product "$PRODUCT" \
  --version "$VERSION" \
  --dir "$PLUGIN_DIR" \
  --changelog "$CHANGELOG"

echo "[release] Verifying the store now serves it..."
sleep 2
curl -s "https://divi5lab.com/api/plugin/update-check?product=${PRODUCT}&version=1.0.0"
echo
