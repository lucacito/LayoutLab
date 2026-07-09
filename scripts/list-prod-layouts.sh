#!/bin/bash
# List published layouts on prod with preview image keys
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.prod; set +a
docker exec -e PU="$DATABASE_URL_UNPOOLED" layoutlab-db sh -c 'psql "$PU" -t -A -F "|" -c "SELECT slug, type, status, preview_image_keys FROM layouts ORDER BY created_at"'
