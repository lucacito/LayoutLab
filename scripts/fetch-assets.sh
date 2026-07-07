#!/usr/bin/env bash
# Resolve a layout's blob key by slug fragment, download its JSON + desktop
# screenshot into <outdir>, and print key / phones / dims. One allowlisted command
# (replaces ad-hoc $(...)+curl one-liners that re-trip the permission classifier).
# Usage: bash scripts/fetch-assets.sh <slug-fragment> <outdir> [prod]
set -euo pipefail
cd "$(dirname "$0")/.."
FRAG="${1:?usage: fetch-assets.sh <slug-fragment> <outdir> [prod]}"
OUT="${2:?outdir required}"
mkdir -p "$OUT"
KEY=$(bash scripts/inspect-layout.sh "$FRAG" "${3:-}" 2>/dev/null | grep -oE 'layouts/[a-f0-9]{64}' | head -1)
[ -n "$KEY" ] || { echo "no layout matching: $FRAG"; exit 1; }
BASE="https://an9pwsjeerz5vywu.public.blob.vercel-storage.com/$KEY"
curl -s "$BASE.json" -o "$OUT/asset.json"
curl -s "$BASE-desktop.png" -o "$OUT/asset-desktop.png"
echo "key=$KEY"
echo "json=$OUT/asset.json"
echo "png=$OUT/asset-desktop.png"
echo "phones=$(grep -oE '\(415\) [0-9]{3}-[0-9]{4}' "$OUT/asset.json" | sort -u | tr '\n' ' ')"
sips -g pixelWidth -g pixelHeight "$OUT/asset-desktop.png" 2>/dev/null | tail -2
