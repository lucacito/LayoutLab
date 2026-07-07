#!/usr/bin/env bash
# POC: convert ONE Divi 4 DiviFlash library JSON → Divi 5 blocks via Divi's own
# PHP converter (Conversion::maybeConvertContent), no browser. Prints block counts.
# Usage: bash scripts/convert-poc.sh <library-json> <out-d5-html>
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:?usage: convert-poc.sh <library-json> <out-d5-html>}"
OUT="${2:?out path required}"
CT=divi5val_wpcli
TMP="$(mktemp -d)"
# DiviFlash wrapper: {"context":"et_builder_layouts","data":{ID:{post_content:"[shortcodes]"}}}
jq -r '.data | to_entries[0].value.post_content' "$SRC" > "$TMP/d4.html"
echo "D4 chars=$(wc -c < "$TMP/d4.html")  et_pb_section=$(grep -oE 'et_pb_section ' "$TMP/d4.html" | wc -l | tr -d ' ')"
cat > "$TMP/convert.php" <<'PHP'
<?php
$cls = 'ET\\Builder\\Packages\\Conversion\\Conversion';
if (!class_exists($cls)) { echo "CLASS_MISSING\n"; exit; }
$content = file_get_contents('/tmp/poc_d4.html');
if (method_exists($cls,'initialize_shortcode_framework')) { $cls::initialize_shortcode_framework(); }
$out = $cls::maybeConvertContent($content, true, 0);
file_put_contents('/tmp/poc_d5.html', $out);
echo "OK ".strlen($out)." chars\n";
PHP
docker cp "$TMP/d4.html" "$CT:/tmp/poc_d4.html" >/dev/null
docker cp "$TMP/convert.php" "$CT:/tmp/poc_convert.php" >/dev/null
docker exec "$CT" wp eval-file /tmp/poc_convert.php 2>&1 | tail -8
docker cp "$CT:/tmp/poc_d5.html" "$OUT" >/dev/null 2>&1 || { echo "NO D5 OUTPUT"; exit 1; }
echo "D5 chars=$(wc -c < "$OUT")  wp:divi/section=$(grep -oE 'wp:divi/section' "$OUT" | wc -l | tr -d ' ')  wp:divi/=$(grep -oE 'wp:divi/[a-z-]+' "$OUT" | sort -u | tr '\n' ' ')"
rm -rf "$TMP"
