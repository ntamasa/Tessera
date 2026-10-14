#!/usr/bin/env bash
# Usage: plan.sh <project-name> <spec path inside the target repo>
# Opens the interactive architect-plans session for one epic. The session runs on the model and
# effort set in the skill's own front matter: a skill's model only lasts one turn, and planning
# is a conversation over many turns.
set -euo pipefail
WF=/workspace/workflow
[[ $# -eq 2 ]] || { echo "usage: plan.sh <project-name> <spec path inside the target repo>" >&2; exit 1; }
dir=/workspace/projects/$1
"$WF/bin/bootstrap.sh"
repo=$(yq -r ".projects[] | select(.name == \"$1\") | .repo" "$WF/projects.yaml")
[[ -n "$repo" && "$repo" != null ]] || { echo "plan.sh: project '$1' isn't in projects.yaml" >&2; exit 1; }
[ -d "$dir" ] || git clone -q "$repo" "$dir"
cd "$dir" && git pull -q
[[ -f "$2" ]] || { echo "plan.sh: spec $2 not found in $dir" >&2; exit 1; }
sk=$WF/agent/skills/architect-plans/SKILL.md     # its front matter sets the model and effort
"$WF/bin/agent" interactive --model "$("$WF/bin/frontmatter" "$sk" model)" \
  --effort "$("$WF/bin/frontmatter" "$sk" effort)" --prompt "/architect-plans $2"
