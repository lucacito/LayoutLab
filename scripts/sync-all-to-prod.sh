#!/usr/bin/env bash
# Sync ALL local published (non-seed) layouts to prod. Idempotent (content-hash
# dedupe): already-live layouts no-op; new ones land as `pending` on prod → approve
# in the live admin. Optional --type=<t> or --slugs=a,b to narrow. Dry-run first
# (no --confirm) to preview.
# Usage: bash scripts/sync-all-to-prod.sh [--confirm] [--type=hero] [--slugs=a,b]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
export TARGET_INGEST_URL="$(grep '^TARGET_INGEST_URL=' .env.prod | cut -d= -f2- | tr -d '"')"
export TARGET_INGEST_TOKEN="$(grep '^TARGET_INGEST_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
export BLOB_READ_WRITE_TOKEN="$(grep '^BLOB_READ_WRITE_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
npm run sync-to-prod -- "$@"
