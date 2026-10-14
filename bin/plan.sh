#!/usr/bin/env bash
# Usage: plan.sh <spec path inside the project>          (`tessera plan <spec>`)
# Opens the interactive architect-plans session for one epic. The session runs on the model and
# effort set in the skill's own front matter: a skill's model only lasts one turn, and planning
# is a conversation over many turns.
set -euo pipefail
WF=/workspace/workflow
[[ $# -eq 1 ]] || { echo "usage: plan.sh <spec path inside the project>" >&2; exit 1; }
"$WF/bin/bootstrap.sh"
cd /workspace/project
[[ -f "$1" ]] || { echo "plan.sh: spec $1 not found in the project" >&2; exit 1; }
git fetch -q origin
sk=$WF/agent/skills/architect-plans/SKILL.md     # its front matter sets the model and effort
"$WF/bin/agent" interactive --model "$("$WF/bin/frontmatter" "$sk" model)" \
  --effort "$("$WF/bin/frontmatter" "$sk" effort)" --prompt "/architect-plans $1"
