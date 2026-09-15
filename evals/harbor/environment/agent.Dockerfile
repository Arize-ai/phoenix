# Coding-agent container. Both agents are preinstalled so Harbor's adapters
# skip their network install. The px CLI and the verifier toolchain live under
# /opt so neither is on PATH unless a condition puts it there.
# Build context (staged by scripts/build_images.sh):
#   evals/__init__.py, evals/harbor/__init__.py, evals/harbor/lib/   grading library
FROM node:22-bookworm-slim
ARG CLAUDE_CODE_VERSION=2.1.267
ARG CODEX_VERSION=0.154.0
ARG PX_VERSION=1.18.2
ARG PHOENIX_CLIENT_VERSION=3.5.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv git curl ca-certificates ripgrep jq procps \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}"
RUN npm install -g --prefix /opt/px "@arizeai/phoenix-cli@${PX_VERSION}"
RUN python3 -m venv /opt/verifier \
    && /opt/verifier/bin/pip install --no-cache-dir "arize-phoenix-client==${PHOENIX_CLIENT_VERSION}"
COPY evals/ /opt/verifier/evals/
RUN mkdir -p /workspace
WORKDIR /workspace
