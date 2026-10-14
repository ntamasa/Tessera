# Tessera sandbox image. Contains only stack-neutral tooling plus Tessera itself; each target
# repo's own toolchain is installed on demand by mise from that repo's mise.toml.
# Built and started by bin/tessera, never directly.
FROM ubuntu:24.04
ARG DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

# Stack-neutral tooling. Node is here for the workflow's own scripts and for agent CLIs
# shipped via npm.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq unzip make build-essential python3 python3-pip docker.io gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/gh.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/gh.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/gh.list \
 && apt-get update && apt-get install -y gh \
 && curl -fsSL -o /usr/local/bin/yq \
      "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_$(dpkg --print-architecture)" \
 && chmod +x /usr/local/bin/yq \
 && pip3 install --break-system-packages uv semgrep \
 && rm -rf /var/lib/apt/lists/*

# Non-root user (some agent CLIs refuse to bypass permissions as root). bin/tessera sets its UID
# to the host user's on Linux, so files it writes to the mounted project folder belong to you.
# ubuntu:24.04 ships a `ubuntu` user on UID 1000, so drop it.
ARG AGENT_UID=1000
RUN userdel -r ubuntu 2>/dev/null || true \
 && useradd -m -s /bin/bash -u "${AGENT_UID}" agent \
 && usermod -aG docker agent

# The agent CLI, installed by its adapter. If the CLI has a system-wide policy file that
# project config can't override, the adapter links the workflow's policy there.
ARG AGENT_CLI
COPY adapters/ /workspace/workflow/adapters/
RUN /workspace/workflow/adapters/${AGENT_CLI}/install-cli.sh

# Per-project toolchains, installed from each target repo's mise.toml. The mount points are
# created as the agent user so new named volumes inherit its ownership.
USER agent
RUN mkdir -p /home/agent/.agent-state /home/agent/.local/share/mise \
 && curl -fsSL https://mise.run | sh
ENV PATH="/home/agent/.local/bin:/home/agent/.local/share/mise/shims:${PATH}"
RUN mise use -g gitleaks@latest

# Node dependencies of the workflow's scripts, and the Chromium revision the pinned Playwright
# expects. The browser folder belongs to the agent user, so Playwright MCP can add its own.
USER root
WORKDIR /workspace/workflow
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
 && npx --no-install playwright install --with-deps chromium \
 && chown -R agent:agent /opt/ms-playwright

# The workflow itself, last because it changes most often. Owned by root: agents can read the
# rules that constrain them but never change them.
COPY . .

USER agent
WORKDIR /workspace/project
