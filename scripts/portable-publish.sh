#!/usr/bin/env bash
# Build and publish the import files (global colors + module presets) for a theme pack. See scripts/portable-publish.ts.
# Usage: bash scripts/portable-publish.sh <id> [--confirm|--remove] [--confirm]
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
PACK="${1:?pack id}" npx tsx scripts/portable-publish.ts "${@:2}"
