#!/usr/bin/env bash
# The nightly run (cron). Works the enabled projects in projects.yaml order, each up to its
# max_tickets_per_day, with one fresh orchestrator session per ticket. A usage limit stops the
# whole run; the state files make the next run resume at the same round and step.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data
mkdir -p "$DATA/logs"
exec 9> "$DATA/agent.lock"; flock 9               # wait for any running resume to finish

git -C "$WF" pull -q --ff-only                    # pick up workflow changes you merged
"$WF/bin/bootstrap.sh" || exit 1
LOG=$DATA/logs/$(date +%F); mkdir -p "$LOG"

while read -r p; do
  name=$(jq -r .name <<< "$p")
  max=$(jq -r '.max_tickets_per_day // 6' <<< "$p")

  for i in $(seq 1 "$max"); do
    "$WF/bin/orchestrate.sh" "$name" "$LOG/$name-$i"
    code=$?
    result=$(jq -r '.result // "unknown"' "$DATA/$name/last-run.json" 2>/dev/null || echo unknown)
    echo "$(date -Is) $name run $i exit=$code result=$result" >> "$LOG/summary.log"

    case "$result" in
      no-tickets|setup-failed) break ;;          # next project
      done|escalated) continue ;;                # next ticket
      *) jq -e .limit_hit "$LOG/$name-$i.json" >/dev/null 2>&1 && break 2   # usage limit hit: resume tomorrow
         continue ;;
    esac
  done
done < <(yq -o=json -I=0 '.projects[] | select(.enabled != false)' "$WF/projects.yaml")
