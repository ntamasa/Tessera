#!/usr/bin/env bash
# Installs the workflow's agent configuration and sets your git identity. Runs at the start of
# every scheduled run and session: anything outside the mounted volumes is lost when a --rm
# container exits. Idempotent.
set -euo pipefail
wf=/workspace/workflow
mkdir -p /workspace/data/logs

: "${GIT_NAME:?set GIT_NAME in secrets.env}" "${GIT_EMAIL:?set GIT_EMAIL in secrets.env}"
git config --global user.name "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"
gh auth setup-git

# Rules, subagents, skills, policy, hook and MCP servers, in the CLI's own formats
"$wf/bin/agent" install

# Playwright, pixelmatch and axe for design-diff.mjs and a11y-scan.mjs, plus the Chromium
# revision the pinned Playwright expects (a no-op when it's already installed)
(cd "$wf" && npm ci --silent --no-audit --no-fund && npx --no-install playwright install chromium >/dev/null)
