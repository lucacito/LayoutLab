#!/usr/bin/env bash
# Print a published layout's asset refs by slug (or fragment).
# Usage: bash scripts/inspect-layout.sh <slug-or-fragment>
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
# Optional 2nd arg "prod" → target the prod (Neon) DB instead of local.
if [ "${2:-}" = "prod" ]; then
  TARGET_DB_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.prod | cut -d= -f2- | tr -d '"')"
  export TARGET_DB_URL
fi
npx tsx scripts/inspect-layout.ts "${1:?usage: inspect-layout.sh <slug-or-fragment> [prod]}"
