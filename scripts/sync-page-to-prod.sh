#!/usr/bin/env bash
# Sync a locally-generated layout (by slug) to prod via the ingest API. Lands as
# `pending` on prod (no auto-approve) → approve in the live admin.
# Usage: bash scripts/sync-page-to-prod.sh <slug>
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG="${1:?usage: sync-page-to-prod.sh <slug>}"
set -a; . ./.env.local; set +a                       # local db (source) + shared blob
export TARGET_INGEST_URL="$(grep '^TARGET_INGEST_URL=' .env.prod | cut -d= -f2- | tr -d '"')"
export TARGET_INGEST_TOKEN="$(grep '^TARGET_INGEST_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
export BLOB_READ_WRITE_TOKEN="$(grep '^BLOB_READ_WRITE_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
npm run sync-to-prod -- --slugs="$SLUG" --confirm
