#!/usr/bin/env bash
# Resumes every escalated ticket of this project that the owner has answered (`tessera resume`
# from cron every 30 minutes, and right after `tessera answer`). Cheap: it only looks for answer
# files on disk, starts the agent only when there is one, and never reads GitHub or Jira.
# bin/tessera runs one container per project at a time, so it never overlaps another run.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data
mkdir -p "$DATA/logs"
booted=

for f in "$DATA"/state/*.json; do
  [ -e "$f" ] || continue
  # Re-read on every iteration: an earlier session may already have resumed this ticket
  [ "$(jq -r '.status // ""' "$f" 2>/dev/null)" = "awaiting-human" ] || continue
  ticket=$(jq -r .ticket "$f")
  [ -e "$DATA/escalations/$ticket.answer.md" ] || continue
  [ -n "$booted" ] || { "$WF/bin/bootstrap.sh" || exit 1; booted=1; }
  "$WF/bin/orchestrate.sh" "$DATA/logs/resume-$ticket-$(date +%s)" "$ticket"
done
