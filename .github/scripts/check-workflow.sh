#!/usr/bin/env bash
# Static checks of this repository's own files. Run by .github/workflows/ci.yml; runs locally
# too (needs shellcheck, jq, yq and node). Prints every problem, exits 1 if there were any.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1
fail=0
problem() { echo "FAIL: $*" >&2; fail=1; }
frontmatter() { awk 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {exit} f' "$1"; }

echo "== shellcheck"
mapfile -t scripts < <(grep -rlE '^#!/usr/bin/env bash' bin adapters agent/hooks .github/scripts)
shellcheck -x "${scripts[@]}" || problem "shellcheck"

echo "== executable bits"
for f in "${scripts[@]}" bin/*.mjs; do
  [[ "$(git ls-files -s -- "$f" | cut -c1-6)" == 100755 ]] || problem "$f is not executable in git"
done

echo "== YAML and JSON"
while IFS= read -r f; do yq -e '.' "$f" >/dev/null || problem "invalid YAML: $f"; done \
  < <(git ls-files '*.yml' '*.yaml')
while IFS= read -r f; do jq -e '.' "$f" >/dev/null || problem "invalid JSON: $f"; done \
  < <(git ls-files '*.json')

echo "== agent files: front matter, model, effort, tool groups"
efforts='^(low|medium|high|xhigh|max)$'
models='^claude-(fable|opus|sonnet|haiku)-[0-9]+-[0-9]+$'
groups='^(read|search|edit|shell|browser|jira)$'
for f in agent/agents/*.md; do
  fm=$(frontmatter "$f")
  yq -e 'type == "!!map"' <<< "$fm" >/dev/null 2>&1 || { problem "$f: invalid front matter"; continue; }
  [[ "$(yq -r '.name' <<< "$fm")" == "$(basename "$f" .md)" ]] || problem "$f: name doesn't match the file name"
  [[ -n "$(yq -r '.description // ""' <<< "$fm")" ]] || problem "$f: no description"
  [[ "$(yq -r '.model // ""' <<< "$fm")" =~ $models ]] || problem "$f: model missing or not a model id"
  [[ "$(yq -r '.effort // ""' <<< "$fm")" =~ $efforts ]] || problem "$f: effort missing or invalid"
  while IFS= read -r g; do [[ "$g" =~ $groups ]] || problem "$f: unknown tool group '$g'"; done \
    < <(yq -r '.tools[]?' <<< "$fm")
done
for f in agent/skills/*/SKILL.md; do
  fm=$(frontmatter "$f")
  yq -e 'type == "!!map"' <<< "$fm" >/dev/null 2>&1 || { problem "$f: invalid front matter"; continue; }
  [[ "$(yq -r '.name' <<< "$fm")" == "$(basename "$(dirname "$f")")" ]] || problem "$f: name doesn't match its folder"
  [[ -n "$(yq -r '.description // ""' <<< "$fm")" ]] || problem "$f: no description"
done
for f in agent/skills/architect-plans/SKILL.md prompts/orchestrator.md; do
  [[ "$(bin/frontmatter "$f" model)" =~ $models ]] || problem "$f: model missing or not a model id"
  [[ "$(bin/frontmatter "$f" effort)" =~ $efforts ]] || problem "$f: effort missing or invalid"
done

echo "== templates/AGENTS.md config block"
bin/wf-config templates | jq -e '.jira_project and .base_branch and (.components | length > 0)' >/dev/null \
  || problem "templates/AGENTS.md: the config block doesn't parse"

echo "== Node scripts"
for f in bin/*.mjs bin/lib/*.mjs; do node --check "$f" || problem "node --check $f"; done

(( fail == 0 )) && echo "All checks passed"
exit $fail
