#!/usr/bin/env bash
# Usage: post-review.sh <pr-number> <commit-sha> <round> <reviewer.json> [summary-suffix]
# (run from the target repo root)
#
# Posts one reviewer's round on the PR as a single GitHub review on the commit it reviewed: a
# one-line summary body, and every anchored finding as an inline comment on its exact line or
# block. The input is diff-hunks --check output. Findings with "anchored": false are not posted
# inline; the orchestrator lists them under "Unanchored findings" in the PR body.
#
# A reviewer with zero findings still gets a review, so every round is recorded on GitHub.
# The optional suffix says what earlier rounds fixed, e.g. "SEC-1 fixed in a1b2c3d".
# PR comments are documentation only: nothing in the workflow ever reads them back.
set -euo pipefail
[[ $# -ge 4 && -f "$4" ]] \
  || { echo "usage: post-review.sh <pr-number> <commit-sha> <round> <reviewer.json> [summary-suffix]" >&2; exit 1; }
pr=$1; commit=$2; round=$3; findings=$4; suffix=${5:-}

jq --arg commit "$commit" --arg round "$round" --arg suffix "$suffix" '
  (.findings // []) as $f | .reviewer as $who
  | {
      commit_id: $commit,
      event: "COMMENT",
      body: ("\($who) · round \($round) · \($f | length) finding\(if ($f | length) == 1 then "" else "s" end)"
             + (if $suffix != "" then " · \($suffix)" else "" end)),
      comments: [
        $f[] | select(.anchored != false)
        | {path: .file, line: .line, side: "RIGHT",
           body: "**\(.id) · \(.severity) · \($who)**\n\n\(.problem)\n\n**Fix:** \(.fix)"}
          + (if .start_line != null and .start_line != .line
             then {start_line: .start_line, start_side: "RIGHT"} else {} end)
      ]
    }' "$findings" \
  | gh api "repos/{owner}/{repo}/pulls/$pr/reviews" --input - > /dev/null
