#!/bin/bash
# Nightly (3am Jujuy) free-section factory: resume the diverse `vary` batch with the
# improved (library-exemplar) generator, then sync new sections to prod (pending →
# approve in admin). DEFENSIVE: skips cleanly (exit 0) if the local stack isn't up or
# a pipeline is already running. Safe to run by hand too.
set -uo pipefail
PROJECT="/Users/Lucas/Documents/JHMG-Local/layoutlab"
VALIDATOR="/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/scripts/validate.php"
# launchd starts with a bare PATH — spell out node/npm/docker/php/claude locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/Lucas/.local/bin"
cd "$PROJECT" || exit 0
LOGDIR="$PROJECT/pipeline/out/cron-logs"; mkdir -p "$LOGDIR"
LOG="$LOGDIR/nightly-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
echo "[nightly] $(date) — start"

# Don't double-run against the single Docker render env.
if pgrep -f "pipeline/index.ts" >/dev/null 2>&1; then echo "[nightly] a pipeline is already running — skipping."; exit 0; fi
# Preconditions — skip cleanly if the local stack isn't ready.
if ! command -v docker >/dev/null || ! docker ps >/dev/null 2>&1; then echo "[nightly] Docker not available — skipping."; exit 0; fi
for c in layoutlab-db divi5val_wpcli divi5val_wp; do
  docker ps --format '{{.Names}}' | grep -qx "$c" || { echo "[nightly] container '$c' not running — skipping."; exit 0; }
done
[ -f "$VALIDATOR" ] || { echo "[nightly] validator missing — skipping."; exit 0; }
# Auto-detect the layoutlab dev-server port (npm run dev may land on 3000/3001/3002…).
APP_URL=""
for p in 3000 3001 3002 3003; do
  if curl -sf -o /dev/null "http://localhost:$p"; then APP_URL="http://localhost:$p"; break; fi
done
[ -n "$APP_URL" ] || { echo "[nightly] no local app on :3000-3003 — skipping (ingest would fail)."; exit 0; }
echo "[nightly] app detected at $APP_URL"

set -a; . ./.env.local; set +a
export VALIDATOR_CMD="php \"$VALIDATOR\""
export INGEST_URL="$APP_URL"

echo "[nightly] generating (USE_LIBRARY_EXEMPLARS=${USE_LIBRARY_EXEMPLARS:-0}, budget=${PIPELINE_MAX_BUDGET_USD:-?})…"
# caffeinate keeps the Mac awake for the whole run (prevents idle sleep mid-batch).
# Effective when on power; a lid-closed laptop on battery may still clamshell-sleep.
caffeinate -i -s -- npm run pipeline -- vary --type="hero,cta,features,pricing,testimonials,faq,contact,gallery,footer,cards" --count=8 || echo "[nightly] generation ended (likely usage 429) — continuing to sync."

echo "[nightly] syncing new sections to prod (idempotent; land as pending)…"
bash scripts/sync-all-to-prod.sh --confirm || echo "[nightly] prod sync failed (non-fatal) — sections are safe locally."

echo "[nightly] $(date) — done. Review pending layouts in /admin/queue."
