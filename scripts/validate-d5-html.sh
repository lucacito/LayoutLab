#!/usr/bin/env bash
# Wrap a raw Divi 5 post_content (block HTML) as a layout JSON and run the
# deterministic validator on it. Usage: bash scripts/validate-d5-html.sh <html-file>
set -euo pipefail
cd "$(dirname "$0")/.."
F="${1:?usage: validate-d5-html.sh <html-file>}"
set -a; . ./.env.local; set +a
TMP="$(mktemp -d)"
node -e "const fs=require('fs');fs.writeFileSync(process.argv[2],JSON.stringify({post_title:'Converted',post_content:fs.readFileSync(process.argv[1],'utf8')}))" "$F" "$TMP/layout.json"
php "/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/scripts/validate.php" "$TMP/layout.json" 2>&1 | head -40
rm -rf "$TMP"
