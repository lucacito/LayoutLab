#!/usr/bin/env bash
# Sync the canonical PHP license client into the Pro plugin(s).
set -euo pipefail
SRC="$(dirname "$0")/../lib/license-server/php-client/class-license-client.php"
DEST_E2D5="/Users/Lucas/Documents/JHMG-Local/jhmg-elementor-to-divi5/plugin/jhmg-converter-for-elementor-to-divi-pro/includes/licensing/class-license-client.php"
mkdir -p "$(dirname "$DEST_E2D5")"
cp "$SRC" "$DEST_E2D5"
echo "synced -> $DEST_E2D5"
