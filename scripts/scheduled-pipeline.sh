#!/bin/bash
# Scheduled generation run for Divi5Lab — safe to run unattended (launchd/cron) or by hand.
#
# It grows the catalog a few layouts at a time: Claude generates → the deterministic
# validator + content-lint gate + dedupe filter → local Docker WP renders screenshots →
# ingest lands them (auto-approved via INGEST_AUTO_APPROVE) for your review.
#
# It is DEFENSIVE: if Docker, the local app, or the validator aren't up, it logs and
# exits 0 (no error, no half-run). Tune COUNT / TYPES / budget via the env block below.

set -uo pipefail

PROJECT="/Users/Lucas/Documents/JHMG-Local/layoutlab"
VALIDATOR="/Users/Lucas/Documents/JHMG-Local/Divi 5 Deterministic Validator/scripts/validate.php"
# launchd/cron start with a bare PATH — spell out where node/npm/docker/php/claude live.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/Users/Lucas/.local/bin:$(dirname "$(command -v node 2>/dev/null || echo /usr/local/bin/node)")"

# --- tunables -------------------------------------------------------------
COUNT="${PIPELINE_COUNT:-1}"                         # layouts per type per run
TYPES="${PIPELINE_TYPES:-hero,cta,features,pricing,testimonials,faq,contact,gallery}"
export PIPELINE_MAX_BUDGET_USD="${PIPELINE_MAX_BUDGET_USD:-1}"  # per-LLM-call cap
# --------------------------------------------------------------------------

LOGDIR="$PROJECT/pipeline/out/cron-logs"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/run-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG") 2>&1
echo "[cron] $(date) — scheduled pipeline start"

cd "$PROJECT" || { echo "[cron] cannot cd to project"; exit 0; }

# Preconditions — skip cleanly (exit 0) if the local stack isn't ready.
if ! command -v docker >/dev/null || ! docker ps >/dev/null 2>&1; then
  echo "[cron] Docker not available — skipping this run."; exit 0; fi
for c in layoutlab-db divi5val_wpcli divi5val_wp; do
  docker ps --format '{{.Names}}' | grep -qx "$c" || { echo "[cron] container '$c' not running — skipping."; exit 0; }
done
if ! curl -sf -o /dev/null http://localhost:3000; then
  echo "[cron] local app (localhost:3000) not up — skipping (ingest would fail)."; exit 0; fi
if [ ! -f "$VALIDATOR" ]; then echo "[cron] validator not found at $VALIDATOR — skipping."; exit 0; fi

# Env: local secrets + validator wiring.
set -a; . ./.env.local; set +a
export VALIDATOR_CMD="php \"$VALIDATOR\""
export INGEST_URL="${INGEST_URL:-http://localhost:3000}"

echo "[cron] generating: types=$TYPES count=$COUNT"
npm run pipeline -- vary --type="$TYPES" --count="$COUNT"
echo "[cron] $(date) — scheduled pipeline done. Review new 'pending' layouts in /admin/queue."
