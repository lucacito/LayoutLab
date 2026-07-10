#!/usr/bin/env bash
# Sync ONLY the Brightwell dental landing to prod (divi5lab.com). Reads the local
# published row (source of the new asset refs) and re-ingests via the prod ingest
# API — idempotent (content-hash dedupe), assets already live in the shared Blob
# store so nothing re-uploads. Pass --confirm to actually write; omit for dry-run.
# Usage: bash scripts/sync-brightwell-to-prod.sh [--confirm]
set -euo pipefail
cd "$(dirname "$0")/.."
SLUG='brightwell-family-dental-minimal-medical-landing-page-for-divi-5'
set -a; . ./.env.local; set +a                       # local DB (source rows) + blob token
export TARGET_INGEST_URL='https://divi5lab.com'
export TARGET_INGEST_TOKEN="$(grep '^INGEST_API_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
export BLOB_READ_WRITE_TOKEN="$(grep '^BLOB_READ_WRITE_TOKEN=' .env.prod | cut -d= -f2- | tr -d '"')"
npm run sync-to-prod -- --slugs="$SLUG" "$@"
