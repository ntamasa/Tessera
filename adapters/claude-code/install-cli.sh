#!/usr/bin/env bash
# Claude Code adapter: installs the CLI at image build time (runs as root).
set -euo pipefail

npm install -g @anthropic-ai/claude-code

# Claude Code reads a system-wide managed policy that user and project settings can't loosen.
# `agent install` writes the translated agent/policy.yaml to the persistent agent-state volume
# on every run; this link makes it the managed policy.
mkdir -p /etc/claude-code
ln -sf /home/agent/.agent-state/claude/managed-settings.json /etc/claude-code/managed-settings.json
