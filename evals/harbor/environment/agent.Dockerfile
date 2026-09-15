# Both coding agents are preinstalled so Harbor does not install them during
# a trial. Only the agent-cli target installs px, under /opt/px and on PATH;
# the base image has no px at all. The verifier stays off PATH in both images.
FROM node:22-bookworm-slim AS agent
ARG CLAUDE_CODE_VERSION=2.1.267
ARG CODEX_VERSION=0.154.0
ARG PX_VERSION=1.18.2
ARG PHOENIX_CLIENT_VERSION=3.5.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv git curl ca-certificates ripgrep jq procps \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}"
RUN python3 -m venv /opt/verifier \
    && /opt/verifier/bin/pip install --no-cache-dir "arize-phoenix-client==${PHOENIX_CLIENT_VERSION}"
COPY evals/ /opt/verifier/evals/
RUN mkdir -p /workspace
WORKDIR /workspace

FROM agent AS agent-cli
RUN npm install -g --prefix /opt/px "@arizeai/phoenix-cli@${PX_VERSION}" \
    && ln -s /opt/px/bin/px /usr/local/bin/px
