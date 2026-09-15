FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
# Node 22 for the Claude Code agents. Claude Code's installer wants node and npm on the
# PATH, and @arizeai/phoenix-cli requires Node 22 or newer. Copied from the official image
# because Debian bookworm ships Node 18. Claude Code and px are preinstalled below so a
# trial needs no internet beyond the LLM provider API.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl procps \
  && rm -rf /var/lib/apt/lists/*
ARG CLAUDE_CODE_VERSION=2.1.267
ARG PX_VERSION=1.18.2
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@arizeai/phoenix-cli@${PX_VERSION}"
# Harbor runs the agent from the image's working directory; coding agents leave their
# .px/coding sidecars here.
WORKDIR /app
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
