#!/usr/bin/env bash
# Quick progress readout for a running/finished pipeline batch log.
# Usage: bash scripts/batch-status.sh <logfile> [total-targets]
set -uo pipefail
LOG="${1:?usage: batch-status.sh <logfile> [total]}"
TOTAL="${2:-$(grep -oE '[0-9]+ target' "$LOG" 2>/dev/null | head -1 | grep -oE '[0-9]+' || echo '?')}"
ing=$(grep -c 'ingested' "$LOG" 2>/dev/null)
drp=$(grep -c 'drop ' "$LOG" 2>/dev/null)
ded=$(grep -c 'dedupe' "$LOG" 2>/dev/null)
err=$(grep -c 'error on' "$LOG" 2>/dev/null)
lim=$(grep -c 'hit your limit' "$LOG" 2>/dev/null)
if grep -q 'summary:' "$LOG" 2>/dev/null; then state="COMPLETE"; elif [ "$lim" -gt 0 ]; then state="usage-limited (winding down)"; else state="RUNNING"; fi
echo "total targets : $TOTAL"
echo "done (ingested): $ing"
echo "dropped        : $drp"
echo "deduped        : $ded"
echo "errored (429)  : $err"
echo "state          : $state"
