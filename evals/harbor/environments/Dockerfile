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
WORKDIR /app
RUN chown agent:agent /app
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/*.whl
COPY verifier/ /opt/verifier/
COPY container_assets/ /opt/phoenix-eval/
COPY data/ /data/
# Root-only: the agent phase runs as `agent` and reaches the data only through Phoenix.
RUN chmod 700 /data && chmod 600 /data/phoenix.db
