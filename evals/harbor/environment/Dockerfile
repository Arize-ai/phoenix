# The one image every Phoenix tool benchmark trial runs in: Phoenix from this checkout
# over a pre-seeded database, the coding agents, and the grading library. Staging
# (scripts/stage_harbor_environments.sh) adds wheels/, data/, lib/, and container_assets/
# beside this file and copies the directory into each tool task's environment/, from
# which Harbor builds the image on Docker or Daytona. The task healthcheck starts
# Phoenix through /opt/phoenix-eval/start_phoenix_server.sh.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
# Node 22 for the coding agents and the px CLI. Copied from the official image because
# Debian bookworm ships Node 18.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git jq procps ripgrep \
  && rm -rf /var/lib/apt/lists/*
# Claude Code and Codex are installed here rather than by Harbor at trial start: the
# Codex installer fetches nvm from GitHub, which the allowlist blocks. The job file pins
# the same versions, so Harbor verifies them and skips the install. The px CLI is not
# here; the CLI agents upload the archive built from this checkout at install time.
ARG CLAUDE_CODE_VERSION=2.1.267
ARG CODEX_VERSION=0.154.0
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}"
# Harbor runs the agent and the reference solution from the image's working directory.
WORKDIR /app
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
# evals.harbor.lib for the verifier and the reference solutions, off the PATH.
COPY lib/ /opt/verifier/
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
