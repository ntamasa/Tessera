#!/usr/bin/env bash
# Resumes every escalated ticket the owner has answered. Cheap to run (cron, every 30 minutes,
# and right after answer.sh): it only looks for answer files on disk, starts the agent only
# when there is one, and never reads GitHub or Jira.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data
mkdir -p "$DATA/logs"
exec 9> "$DATA/agent.lock"; flock -n 9 || exit 0   # never overlap with another run
booted=

for f in "$DATA"/*/state/*.json; do
  [ -e "$f" ] || continue
  # Re-read on every iteration: an earlier session may already have resumed this ticket
  [ "$(jq -r .status "$f" 2>/dev/null)" = "awaiting-human" ] || continue
  project=$(jq -r .project "$f"); ticket=$(jq -r .ticket "$f")
  [ -e "$DATA/$project/escalations/$ticket.answer.md" ] || continue
  [ -n "$booted" ] || { "$WF/bin/bootstrap.sh" || exit 1; booted=1; }
  "$WF/bin/orchestrate.sh" "$project" "$DATA/logs/resume-$ticket-$(date +%s)" "$ticket"
done
