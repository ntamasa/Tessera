#!/usr/bin/env bash
# Usage: hook-shim.sh <guard>
# Claude Code PreToolUse hook. Converts the hook payload of Edit, Write and NotebookEdit into the
# workflow's neutral {"path": ..., "content": ...} and runs the guard on it. The guard's exit
# code 2 plus stderr is exactly Claude Code's "block with this message" response, so both pass
# through unchanged.
set -uo pipefail
guard=$1

normalized=$(jq -c '.tool_input as $t | {
    path: ($t.file_path // $t.notebook_path // ""),
    content: ($t.content // $t.new_string // $t.new_source
              // ([$t.edits[]?.new_string] | join("\n")))
  }') || {
  [[ -n "${AGENT_AUTONOMOUS:-}" ]] || exit 0
  echo "Blocked: the edit payload could not be read by the workflow's guard." >&2
  exit 2
}

"$guard" <<< "$normalized"
