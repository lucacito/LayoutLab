#!/usr/bin/env bash
# Publish a theme pack to PROD through the production database.
# Usage: bash scripts/pack-publish.sh <id> [--confirm]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
export PROD_DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
PACK="${1:?pack id}" npx tsx scripts/pack-publish.ts "${2:-}"
