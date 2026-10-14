#!/usr/bin/env bash
# The autonomous run of this container's project (`tessera run`, typically from cron). Works the
# project's ready tickets one after another, with one fresh orchestrator session per ticket,
# until none is ready. A usage limit or an error stops the run; the state files make the next
# run resume at the same round and step.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data

"$WF/bin/bootstrap.sh" || exit 1
LOG=$DATA/logs/$(date +%F); mkdir -p "$LOG"

i=0
while true; do
  i=$((i + 1))
  prefix=$LOG/run-$(date +%H%M%S)-$i
  "$WF/bin/orchestrate.sh" "$prefix"
  code=$?
  result=$(jq -r '.result // "unknown"' "$DATA/last-run.json" 2>/dev/null || echo unknown)
  limit=$(jq -r '.limit_hit // false' "$prefix.json" 2>/dev/null || echo false)
  echo "$(date -Is) run $i exit=$code result=$result limit_hit=$limit" >> "$LOG/summary.log"

  case "$result" in
    done|escalated) continue ;;   # next ticket
    *) break ;;                   # no-tickets, setup-failed, usage limit or error
  esac
done
