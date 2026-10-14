#!/usr/bin/env bash
# Usage: orchestrate.sh <log-prefix> [ticket-to-resume]
# One fresh, headless orchestrator session for one ticket of this container's project. Used by
# the autonomous run and by the feedback check. All state lives on disk and in Jira, so each
# session starts with an empty context.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data; dir=/workspace/project
log=$1; resume=${2:-}
mkdir -p "$DATA/state" "$DATA/escalations" "$DATA/logs" "$(dirname "$log")"
rm -f "$DATA/last-run.json"

key=$("$WF/bin/wf-config" "$dir" | jq -r '.jira_project // ""')
if [[ -z "$key" ]]; then
  echo "orchestrate: AGENTS.md declares no jira_project" >&2
  echo '{"result":"setup-failed"}' > "$DATA/last-run.json"
  exit 1
fi

# The prompt: a short header, then prompts/orchestrator.md without its front matter (which
# sets the orchestrator's model and effort)
of=$WF/prompts/orchestrator.md
{ printf 'Project: %s\nRepository: %s\nJira project: %s\nJira site: %s\nProject data folder: %s\nPush notifications: %s\n\n' \
    "${TESSERA_PROJECT:-}" "$dir" "$key" "${JIRA_URL:-}" "$DATA" "$("$WF/bin/agent" notify-support)"
  [[ -z "$resume" ]] || printf 'Resume ticket: %s\n\n' "$resume"
  awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {f=0; next} !f' "$of"; } > "$log.prompt"

cd "$dir" || exit 1
AGENT_AUTONOMOUS=1 "$WF/bin/agent" run \
  --model "$("$WF/bin/frontmatter" "$of" model)" --effort "$("$WF/bin/frontmatter" "$of" effort)" \
  --prompt-file "$log.prompt" --output "$log.json" 2> "$log.err"
code=$?

# Record the orchestrator's own token usage (for reference)
jq -c '{ts: (now | todate), in: (.usage.input_tokens // 0), out: (.usage.output_tokens // 0),
        result: (if .is_error then "error" else "ok" end)}' \
   "$log.json" >> "$DATA/logs/orchestrator-usage.jsonl" 2>/dev/null
exit $code
