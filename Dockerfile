# Tessera sandbox image. Contains only stack-neutral tooling; each target repo's own
# toolchain is installed on demand by mise from that repo's mise.toml.
FROM ubuntu:24.04
ARG DEBIAN_FRONTEND=noninteractive
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

# Stack-neutral tooling. Node is here for the workflow's own scripts and for agent CLIs
# shipped via npm.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git jq unzip make build-essential python3 python3-pip docker.io gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y nodejs \
 && npx -y playwright install --with-deps chromium \
 && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/gh.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/gh.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/gh.list \
 && apt-get update && apt-get install -y gh \
 && curl -fsSL -o /usr/local/bin/yq \
      "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_$(dpkg --print-architecture)" \
 && chmod +x /usr/local/bin/yq \
 && pip3 install --break-system-packages uv semgrep \
 && rm -rf /var/lib/apt/lists/*

# The agent CLI, installed by its adapter. If the CLI has a system-wide policy file that
# project config can't override, the adapter links the workflow's policy there.
ARG AGENT_CLI
COPY adapters/ /opt/adapters/
RUN /opt/adapters/${AGENT_CLI}/install-cli.sh

# Non-root user (some agent CLIs refuse to bypass permissions as root). Its UID must match
# the host user that owns ./workspace; ubuntu:24.04 ships a `ubuntu` user on 1000, so drop it.
ARG AGENT_UID=1000
RUN userdel -r ubuntu 2>/dev/null || true \
 && useradd -m -s /bin/bash -u "${AGENT_UID}" agent \
 && usermod -aG docker agent \
 && chown -R agent:agent /opt/ms-playwright
USER agent

# Create the volume mount points as the agent user, so new named volumes inherit its ownership
RUN mkdir -p /home/agent/.agent-state /home/agent/.local/share/mise

# Per-project toolchains, installed from each target repo's mise.toml
RUN curl -fsSL https://mise.run | sh
ENV PATH="/home/agent/.local/bin:/home/agent/.local/share/mise/shims:${PATH}"
RUN mise use -g gitleaks@latest

WORKDIR /workspace
