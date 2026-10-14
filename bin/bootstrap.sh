#!/usr/bin/env bash
# Installs the workflow's agent configuration and sets your git identity. Runs at the start of
# every container (bin/tessera starts a fresh one each time). Idempotent.
set -euo pipefail
wf=/workspace/workflow
mkdir -p /workspace/data/logs

: "${GIT_NAME:?start Tessera with bin/tessera}" "${GIT_EMAIL:?start Tessera with bin/tessera}"
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
# The project folder is mounted from your machine: trust its owner, and leave its line endings
# as your own git wrote them (CRLF checkouts on Windows otherwise look modified in here)
git config --global --add safe.directory /workspace/project
git config --global core.autocrlf input
gh auth setup-git

# Rules, subagents, skills, policy, hook and MCP servers, in the CLI's own formats
"$wf/bin/agent" install
