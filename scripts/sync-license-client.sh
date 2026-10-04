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

# B2D5 destination: rewrite the namespace and text domain to bricks-to-divi5's own.
DEST_B2D5="/Users/Lucas/Documents/JHMG-Local/jhmg-bricks-to-divi5/plugin/jhmg-converter-for-bricks-to-divi-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_B2D5")"
sed \
  -e 's/ElementorDivi5Converter\\Pro\\Licensing/BricksDivi5Converter\\Pro\\Licensing/g' \
  -e 's/jhmg-converter-for-elementor-to-divi-pro/jhmg-converter-for-bricks-to-divi-pro/g' \
  "$SRC" > "$DEST_B2D5"
echo "synced -> $DEST_B2D5 (transformed: namespace + text domain)"

# AI Editor Pro destination: the separate Pro add-on (pro-addon/), NOT the free WordPress.org plugin.
# The free plugin has no licensing (WordPress.org Guideline 5), so nothing may be written under wp-plugin/.
# Rewrites namespace, text domain, user-facing product name in notices, and the admin link shape
# (top-level admin.php page, the licence UI lives on the "pro" tab). Same transforms as
# scripts/sync-pro-license-client.sh in the AI Editor repo.
DEST_AIED_PRO="/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/pro-addon/src/Licensing/LicenseClient.php"
mkdir -p "$(dirname "$DEST_AIED_PRO")"
sed \
  -e 's/ElementorDivi5Converter\\Pro\\Licensing/AiEditorDivi5\\Pro\\Licensing/g' \
  -e 's/jhmg-converter-for-elementor-to-divi-pro/jhmg-ai-editor-for-divi-5-pro/g' \
  -e 's/JHMG Converter Pro/AI Editor for Divi 5 Pro/g' \
  -e 's/tools\.php/admin.php/g' \
  -e 's/tab=license/tab=pro/g' \
  "$SRC" > "$DEST_AIED_PRO"
echo "synced -> $DEST_AIED_PRO (transformed: namespace + text domain + product name + admin links)"
