#!/usr/bin/env bash
# Validate + (re)load the nightly factory LaunchAgent.
set -uo pipefail
PLIST="$HOME/Library/LaunchAgents/com.divi5lab.pipeline.plist"
echo "=== lint ==="; plutil -lint "$PLIST" || { echo "INVALID plist"; exit 1; }
echo "=== reload ==="; launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST" && echo "loaded OK" || echo "load FAILED"
echo "=== registered? ==="; launchctl list 2>/dev/null | grep -i divi5lab || echo "(not listed)"
echo "=== next scheduled ==="; launchctl print "gui/$(id -u)/com.divi5lab.pipeline" 2>/dev/null | grep -iE "run on demand|state =|next fire|periodic|calendar|program =" | head -8 || echo "(print unavailable)"
