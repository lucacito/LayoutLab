#!/bin/bash
# Print slug|previewImageKeys for given slugs from PROD db
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env.prod; set +a
LIST=$(printf "'%s'," "$@" | sed 's/,$//')
docker exec -e PU="$DATABASE_URL_UNPOOLED" layoutlab-db sh -c "psql \"\$PU\" -t -A -F '|' -c \"SELECT slug, preview_image_keys FROM layouts WHERE slug IN ($LIST)\""
