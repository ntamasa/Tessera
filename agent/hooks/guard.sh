#!/usr/bin/env bash
# Pre-edit guard: the last line of defense against file edits the workflow should never make,
# whatever an agent decides. Driven entirely by the target repo's config block, so it works
# for any stack.
#
# Input on stdin: {"path": "...", "content": "..."}, normalized by the adapter's hook shim, so
# it works with any agent CLI. `content` is the new text being written (the whole file for a
# write, the replacement text for an edit).
# Exit code 2 = block; stderr is shown to the agent. Only applies to autonomous runs
# (AGENT_AUTONOMOUS set): in an interactive session, the human is in charge.
set -uo pipefail
[[ -n "${AGENT_AUTONOMOUS:-}" ]] || exit 0

WF=${TESSERA_WORKFLOW_DIR:-/workspace/workflow}
DATA=${TESSERA_DATA_DIR:-/workspace/data}
block() { echo "Blocked: $*" >&2; exit 2; }

input=$(cat)
raw=$(jq -r '.path // ""' <<< "$input") || block "the edit payload could not be parsed."
[[ -n "$raw" ]] || exit 0
path=$(realpath -m -- "$raw")

# The workflow's data folder (state, fix plans, reports) is always writable.
case "$path" in
  "$DATA"/*) exit 0 ;;
esac

# Everything else must be inside the repository of the active ticket. The workflow repo
# itself (rules, prompts, agents, hooks) is never written by an agent.
current=$DATA/current.json
repo=""; contract_change=false
if [[ -f "$current" ]]; then
  repo=$(jq -r '.repo // ""' "$current")
  contract_change=$(jq -r '.contract_change // false' "$current")
fi
[[ -n "$repo" ]] || block "no ticket is active ($current is missing), so only $DATA may be written."
repo=$(realpath -m -- "$repo")
case "$path" in
  "$repo"/*) ;;
  *) block "writes outside the current project repository ($repo)." ;;
esac
rel=${path#"$repo"/}

cfg=$("$WF/bin/wf-config" "$repo") \
  || block "the Agent workflow config in AGENTS.md can't be read. Escalate."

# Gates and CI belong to the human
[[ "$rel" == AGENTS.md || "$rel" == .github/workflows/* ]] \
  && block "$rel defines the project's gates. Escalate if it needs to change."

# Generated code is never hand-edited
while IFS= read -r p; do
  [[ -n "$p" && "$rel" == "${p#./}"* ]] && block "$rel is generated. Change its source and regenerate."
done < <(jq -r '.components[]?.generated[]?' <<< "$cfg")

# The contract is frozen unless this ticket changes it
contract=$(jq -r '.contract.path // ""' <<< "$cfg")
[[ -n "$contract" && "$rel" == "${contract#./}" && "$contract_change" != true ]] \
  && block "the contract is frozen for this ticket. Escalate if it is wrong."

# Disabling, skipping or focusing tests is not allowed. Each component's skip_pattern applies
# to the files under its tests.paths (to every file if it declares no paths).
in_pathspec() {   # in_pathspec <rel> <git pathspec>: directory prefix or glob match
  local spec=${2#./}; spec=${spec%/}
  [[ "$1" == "$spec" || "$1" == "$spec"/* ]] && return 0
  # shellcheck disable=SC2053  # the pathspec is deliberately a glob
  [[ "$1" == $spec ]]
}
new=$(jq -r '.content // ""' <<< "$input")
while IFS= read -r comp; do
  skip_re=$(jq -r '.tests.skip_pattern // ""' <<< "$comp")
  [[ -n "$skip_re" ]] || continue
  mapfile -t specs < <(jq -r '.tests.paths[]?' <<< "$comp")
  applies=$(( ${#specs[@]} == 0 ))
  for spec in "${specs[@]}"; do
    [[ -n "$spec" ]] && in_pathspec "$rel" "$spec" && { applies=1; break; }
  done
  (( applies )) && grep -Eq -- "$skip_re" <<< "$new" \
    && block "disabling, skipping or focusing tests is not allowed. Fix the code or the test."
done < <(jq -c '.components[]?' <<< "$cfg")
exit 0
