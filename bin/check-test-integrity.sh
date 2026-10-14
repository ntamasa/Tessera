#!/usr/bin/env bash
# Usage: check-test-integrity.sh [base-ref]   (run from the target repo root)
#
# Enforces "never fix by deleting tests" mechanically, for any test framework, using each
# component's tests.case_pattern and tests.skip_pattern (POSIX extended regexes) from AGENTS.md.
# Runs in CI (.github/workflows/test-integrity.yml) and as a check inside the pipeline.
#
# It compares against the merge base, so tests added to the target branch after this branch
# was cut don't count against it. A commit trailer "Test-Removal-Approved-By: <name>" (written
# only when the owner approves in the answer session) allows the test count to go down.
set -euo pipefail
base=${1:-origin/develop}
mb=$(git merge-base "$base" HEAD)
cfg=$("$(dirname "$0")/wf-config" .)
approved=$(git log "$mb"..HEAD --format=%B | grep -c '^Test-Removal-Approved-By: ' || true)
fail=0

count() {   # count <git grep args...>: matching lines; a bad regex is an error, not zero
  local out rc=0
  out=$(git grep "$@") || rc=$?
  (( rc <= 1 )) || { echo "FAIL: git grep $* exited with $rc (check the regex in AGENTS.md)" >&2; exit 2; }
  if [[ -z "$out" ]]; then echo 0; else wc -l <<< "$out"; fi
}

while IFS= read -r comp; do
  name=$(jq -r .name <<< "$comp")
  case_re=$(jq -r '.tests.case_pattern // ""' <<< "$comp")
  skip_re=$(jq -r '.tests.skip_pattern // ""' <<< "$comp")
  mapfile -t paths < <(jq -r '.tests.paths[]?' <<< "$comp")
  if [[ -z "$case_re" || ${#paths[@]} -eq 0 ]]; then
    echo "$name: no tests.paths or tests.case_pattern declared, skipped"
    continue
  fi

  before=$(count -hE "$case_re" "$mb" -- "${paths[@]}")
  after=$(count --untracked -hE "$case_re" -- "${paths[@]}")
  echo "$name: $before tests at merge base, $after now"

  if (( after < before )); then
    if (( approved > 0 )); then
      echo "$name: test count decreased, but the owner approved it in a commit trailer."
    else
      echo "FAIL $name: test count decreased by $((before - after)). Removing tests needs the owner's approval." >&2
      fail=1
    fi
  fi

  if [[ -n "$skip_re" ]] \
     && git diff "$mb" -- "${paths[@]}" | grep -E '^\+' | grep -v '^+++' | grep -E -- "$skip_re"; then
    echo "FAIL $name: tests were disabled, skipped or focused." >&2
    fail=1
  fi
done < <(jq -c '.components[]?' <<< "$cfg")

(( fail == 0 )) && echo "Test integrity OK"
exit $fail
