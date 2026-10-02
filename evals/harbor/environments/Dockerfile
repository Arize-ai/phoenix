# Build the shared Harbor task image from this checkout, the task fixture, the verifier,
# and the agent runtime. scripts/stage_harbor_environments.sh assembles the build context.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
# Node 22 for the coding agents and the px CLI. Copied from the official image because
# Debian bookworm ships Node 18.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git jq procps ripgrep \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /bin/bash agent
# Preinstalled because Harbor's installers need hosts that the allowlist blocks
ARG CLAUDE_CODE_VERSION=2.1.267
ARG CODEX_VERSION=0.154.0
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}" \
  && chmod 700 /usr/local/lib/node_modules/@anthropic-ai /usr/local/lib/node_modules/@openai
# Harbor runs the agent and the reference solution from the image's working directory.
WORKDIR /app
RUN chown agent:agent /app
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
# Root-only: the agent phase runs as `agent` and reaches the data only through Phoenix.
RUN chmod 700 /data && chmod 600 /data/phoenix.db
# Harbor uploads each step's tests/ here before verification and does not remove them
# afterwards, so a later step's agent could read earlier checks. The verifier runs as root.
RUN install -d -m 700 /tests
