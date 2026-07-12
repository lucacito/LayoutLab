#!/usr/bin/env bash
# Sync the canonical PHP license client into the Pro plugin(s).
#
# The canonical source hardcodes E2D5-specific identifiers that can't be
# ctor-parameterized: the PHP namespace (ElementorDivi5Converter\Pro\Licensing)
# and the i18n text domain ('jhmg-converter-for-elementor-to-divi-pro' inside
# __() calls). Text domains must stay literal strings for i18n tooling to pick
# them up, so each destination applies its own sed transform on sync instead.
set -euo pipefail
SRC="$(dirname "$0")/../lib/license-server/php-client/class-license-client.php"

# E2D5 destination: identity sync — the canonical's hardcoded namespace/domain
# already match E2D5, so no transform needed (byte-identical).
DEST_E2D5="/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_E2D5")"
cp "$SRC" "$DEST_E2D5"
echo "synced -> $DEST_E2D5"

# D2E destination: rewrite the namespace and text domain to D2E's own.
DEST_D2E="/Users/Lucas/Documents/JHMG-Local/jhmg-divi-to-elementor/plugin/jhmg-converter-divi-to-elementor-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_D2E")"
sed \
  -e 's/ElementorDivi5Converter\\Pro\\Licensing/DiviElementorConverter\\Pro\\Licensing/g' \
  -e 's/jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-divi-to-elementor-pro/g' \
  "$SRC" > "$DEST_D2E"
echo "synced -> $DEST_D2E (transformed: namespace + text domain)"

# AI Editor destination: single plugin (not a Pro companion). Rewrites namespace,
# text domain, user-facing product name in notices, and the admin link shape
# (top-level admin.php page, license UI lives on the "upgrade" tab).
DEST_AIED="/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/wp-plugin/src/Licensing/LicenseClient.php"
mkdir -p "$(dirname "$DEST_AIED")"
sed \
  -e 's/ElementorDivi5Converter\\Pro\\Licensing/AiEditorDivi5\\Licensing/g' \
  -e 's/jhmg-converter-for-elementor-to-divi-pro/ai-editor-divi5/g' \
  -e 's/JHMG Converter Pro/AI Editor for Divi 5/g' \
  -e 's/tools\.php/admin.php/g' \
  -e 's/tab=license/tab=upgrade/g' \
  "$SRC" > "$DEST_AIED"
echo "synced -> $DEST_AIED (transformed: namespace + text domain + product name + admin links)"
