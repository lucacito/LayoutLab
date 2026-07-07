#!/usr/bin/env bash
# Index the converted D5 corpus into section-level exemplars (pipeline/library/index.json).
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsx scripts/index-library.ts
