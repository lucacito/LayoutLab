#!/usr/bin/env bash
#
# Publish AI Editor for Divi 5 — Pro v3.2.0 to the divi5lab.com store.
# Uploads the zip to Vercel Blob and inserts a plugin_releases row in the PROD
# DB. Shipping an update never requires a Vercel redeploy — divi5lab.com reads
# the new row immediately. Idempotent: plugin_releases is unique on
# (product_slug, version), so a re-run fails cleanly instead of duplicating.
#
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env.prod ]; then echo "ERROR: .env.prod not found" >&2; exit 1; fi

STAGE="/tmp/aied-release/ai-editor-divi5"
if [ ! -f "$STAGE/ai-editor-divi5.php" ]; then
  echo "ERROR: staged plugin dir not found at $STAGE" >&2; exit 1
fi
STAGED_VERSION="$(grep -E "AI_EDITOR_DIVI5_VERSION" "$STAGE/ai-editor-divi5.php" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")"
if [ "$STAGED_VERSION" != "3.2.0" ]; then
  echo "ERROR: staged version is $STAGED_VERSION, expected 3.2.0" >&2; exit 1
fi

# Extract only the vars we need. Do NOT `source .env.prod` wholesale — some
# Vercel-dumped values (e.g. VERCEL_GIT_COMMIT_MESSAGE) contain characters that
# break sourcing partway, silently leaving later vars (POSTGRES_URL) unset.
extract() { grep "^$1=" .env.prod | head -1 | cut -d= -f2- | sed -E 's/^"//; s/"$//'; }
export BLOB_READ_WRITE_TOKEN="$(extract BLOB_READ_WRITE_TOKEN)"
# .env.prod ships POSTGRES_URL="" (blank); the real pooled Neon URL that
# @vercel/postgres needs is in DATABASE_URL (the -pooler endpoint).
export POSTGRES_URL="$(extract DATABASE_URL)"
if [ -z "$POSTGRES_URL" ] || [ -z "$BLOB_READ_WRITE_TOKEN" ]; then
  echo "ERROR: could not read POSTGRES_URL / BLOB_READ_WRITE_TOKEN from .env.prod" >&2; exit 1
fi
echo "[release] env loaded (POSTGRES_URL host: $(echo "$POSTGRES_URL" | sed -E 's#.*@([^/?]+).*#\1#'))"

CHANGELOG='New: surgical page edits — change one thing (an email, phone number, link, or line of copy) without rebuilding the whole page (edit_page_content in MCP / POST /pages/{id}/edit in the ChatGPT action), validated before saving. Fixed: listing Divi 5 pages could fail in ChatGPT ("something went wrong") when the connected API key owner lacked page-edit permissions.'

echo "[release] Publishing ai-editor-divi5-pro 3.2.0 to prod..."
npx tsx scripts/release-plugin.ts \
  --product ai-editor-divi5-pro \
  --version 3.2.0 \
  --dir "$STAGE" \
  --changelog "$CHANGELOG"
