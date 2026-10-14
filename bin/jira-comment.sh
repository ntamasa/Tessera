#!/usr/bin/env bash
# Usage: jira-comment.sh <ISSUE-KEY> <file>
# Posts the file's text as a comment on the Jira issue (used for each fix round's summary).
set -euo pipefail
[[ $# -eq 2 && -f "$2" ]] || { echo "usage: jira-comment.sh <ISSUE-KEY> <file>" >&2; exit 1; }
jq -n --rawfile body "$2" '{body: $body}' \
  | curl -fsS -u "$JIRA_USERNAME:$JIRA_API_TOKEN" -H 'Content-Type: application/json' \
         -X POST --data @- "$JIRA_URL/rest/api/2/issue/$1/comment" > /dev/null
