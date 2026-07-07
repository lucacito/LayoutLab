#!/usr/bin/env bash
# Batch-convert the whole Divi 4 DiviFlash library → validated Divi 5 corpus.
# Per public/layout-library-json/*.json: recursively grab the largest shortcode
# post_content → convert via Divi's Conversion::maybeConvertContent (one WP boot) →
# validate → keep valid ones in pipeline/library/d5/<slug>.json {source, post_content}.
# No LLM usage. Usage: bash scripts/convert-library.sh
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
CT=divi5val_wpcli
LIB="public/layout-library-json"
OUT="pipeline/library/d5"
STAGE="$(mktemp -d)"
RAW="$STAGE/d4"; D5="$STAGE/d5"
mkdir -p "$RAW" "$D5" "$OUT"
VALIDATOR='/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/scripts/validate.php'

echo "=== 1. extract D4 post_content (robust: largest et_pb_ post_content anywhere) ==="
extracted=0; skipped=0
while IFS= read -r f; do
  base="$(basename "$f" .json)"
  slug="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//')"
  content="$(jq -r '[.. | .post_content? // empty] | map(select(test("et_pb_"))) | sort_by(length) | last // empty' "$f" 2>/dev/null)"
  if [ -z "$content" ]; then skipped=$((skipped+1)); continue; fi
  printf '%s' "$content" > "$RAW/$slug.d4.html"
  printf '%s' "$base" > "$RAW/$slug.src"
  extracted=$((extracted+1))
done < <(find "$LIB" -maxdepth 1 -name '*.json' | sort)
echo "extracted=$extracted skipped(no shortcode content)=$skipped"

echo "=== 2. convert all (single WP boot) ==="
docker exec "$CT" sh -c 'rm -rf /tmp/lib_d4 /tmp/lib_d5; mkdir -p /tmp/lib_d4 /tmp/lib_d5'
docker cp "$RAW/." "$CT:/tmp/lib_d4/" >/dev/null
cat > "$STAGE/convert.php" <<'PHP'
<?php
$cls='ET\\Builder\\Packages\\Conversion\\Conversion';
if(!class_exists($cls)){echo "CLASS_MISSING\n";exit;}
if(method_exists($cls,'initialize_shortcode_framework'))$cls::initialize_shortcode_framework();
$ok=0;$err=0;
foreach(glob('/tmp/lib_d4/*.d4.html') as $f){
  $slug=basename($f,'.d4.html');
  try{ $d5=$cls::maybeConvertContent(file_get_contents($f),true,0);
       file_put_contents('/tmp/lib_d5/'.$slug.'.d5.html',$d5); $ok++; }
  catch(\Throwable $e){ echo "ERR $slug ".substr($e->getMessage(),0,80)."\n"; $err++; }
}
echo "converted=$ok errors=$err\n";
PHP
docker cp "$STAGE/convert.php" "$CT:/tmp/lib_convert.php" >/dev/null
docker exec "$CT" wp eval-file /tmp/lib_convert.php 2>&1 | tail -6
docker cp "$CT:/tmp/lib_d5/." "$D5/" >/dev/null 2>&1 || true

echo "=== 3. validate + keep the good ones ==="
valid=0; invalid=0
for d in "$D5"/*.d5.html; do
  [ -e "$d" ] || continue
  slug="$(basename "$d" .d5.html)"
  src="$(cat "$RAW/$slug.src" 2>/dev/null || echo "$slug")"
  wrap="$STAGE/$slug.json"
  node -e "const fs=require('fs');fs.writeFileSync(process.argv[2],JSON.stringify({post_title:'lib',post_content:fs.readFileSync(process.argv[1],'utf8')}))" "$d" "$wrap"
  if php "$VALIDATOR" "$wrap" >/dev/null 2>&1; then
    node -e "const fs=require('fs');fs.writeFileSync(process.argv[3],JSON.stringify({source:process.argv[2],post_content:fs.readFileSync(process.argv[1],'utf8')}))" "$d" "$src" "$OUT/$slug.json"
    valid=$((valid+1))
  else
    invalid=$((invalid+1))
  fi
done
echo "=== summary ==="
echo "valid D5 exemplars kept=$valid  invalid(dropped)=$invalid"
echo "corpus: $OUT ($(find "$OUT" -name '*.json' | wc -l | tr -d ' ') files)"
rm -rf "$STAGE"
