# The one image every Harbor task runs in: Phoenix from this checkout over a fixture
# database, the shared verifiers, and the coding agents' runtime. The build context is
# this file plus wheels/, verifier/, container_assets/, and the task's fixture as
# data/phoenix.db, assembled by scripts/stage_harbor_environments.sh.
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
# Codex is preinstalled because Harbor's installer fetches nvm from GitHub, which the
# allowlist blocks; the job file pins the same version, so Harbor verifies it and skips
# the install. Claude Code is installed by Harbor at trial start from downloads.claude.ai.
ARG CODEX_VERSION=0.154.0
RUN npm install -g "@openai/codex@${CODEX_VERSION}"
# Harbor runs the agent and the reference solution from the image's working directory.
WORKDIR /app
RUN chown agent:agent /app
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
# evals.harbor.verifiers for the verifier and the reference solutions, off the PATH.
COPY verifier/ /opt/verifier/
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
# Root-only: the agent phase runs as `agent` and reaches the data only through Phoenix.
RUN chmod 700 /data && chmod 600 /data/phoenix.db
