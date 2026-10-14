#!/usr/bin/env bash
# Usage: orchestrate.sh <project-name> <log-prefix> [ticket-to-resume]
# One fresh, headless orchestrator session for one ticket of one project. Used by the nightly
# run and by the feedback check. All state lives on disk and in Jira, so each session starts
# with an empty context.
set -uo pipefail
WF=/workspace/workflow; DATA=/workspace/data
name=$1; log=$2; resume=${3:-}
key=$(yq -r ".projects[] | select(.name == \"$name\") | .jira_project" "$WF/projects.yaml")
repo=$(yq -r ".projects[] | select(.name == \"$name\") | .repo" "$WF/projects.yaml")
dir=/workspace/projects/$name
[[ -n "$key" && "$key" != null ]] || { echo "orchestrate: project '$name' isn't in projects.yaml" >&2; exit 1; }
mkdir -p "$DATA/$name/state" "$DATA/$name/escalations" "$DATA/logs" "$(dirname "$log")"
rm -f "$DATA/$name/last-run.json"
[[ -d "$dir/.git" ]] || git clone -q "$repo" "$dir" || exit 1

# The prompt: a short header, then prompts/orchestrator.md without its front matter (which
# sets the orchestrator's model and effort)
of=$WF/prompts/orchestrator.md
{ printf 'Project: %s\nRepository: %s\nJira project: %s\nJira site: %s\nProject data folder: %s\nPush notifications: %s\n\n' \
    "$name" "$dir" "$key" "${JIRA_URL:-}" "$DATA/$name" "$("$WF/bin/agent" notify-support)"
  [[ -z "$resume" ]] || printf 'Resume ticket: %s\n\n' "$resume"
  awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {f=0; next} !f' "$of"; } > "$log.prompt"

cd "$dir" || exit 1
AGENT_AUTONOMOUS=1 "$WF/bin/agent" run \
  --model "$("$WF/bin/frontmatter" "$of" model)" --effort "$("$WF/bin/frontmatter" "$of" effort)" \
  --prompt-file "$log.prompt" --output "$log.json" 2> "$log.err"
code=$?

# Record the orchestrator's own token usage (for reference)
jq -c --arg p "$name" '{ts: (now | todate), project: $p, in: (.usage.input_tokens // 0),
        out: (.usage.output_tokens // 0), result: (if .is_error then "error" else "ok" end)}' \
   "$log.json" >> "$DATA/logs/orchestrator-usage.jsonl" 2>/dev/null
exit $code
