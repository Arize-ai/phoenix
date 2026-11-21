# The base image for the skill-loading tasks. Loading needs no Phoenix server, fixture
# database, or px, so this image holds only the coding agents, the stop scripts, and the
# verifier. ../build_image.sh builds it as phoenix-skill-loading:local.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git jq procps ripgrep \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /bin/bash agent
ARG CLAUDE_CODE_VERSION=2.1.287
ARG CODEX_VERSION=0.154.0
# The agent user can run both CLIs, so Harbor's install check passes and Harbor uses these
# pinned versions instead of installing the latest ones.
RUN npm install -g "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" "@openai/codex@${CODEX_VERSION}"
WORKDIR /app
RUN chown agent:agent /app
# The verifier imports harbor_verifiers.skills, which needs phoenix.evals but not the server.
COPY wheels/ /wheels/
RUN uv pip install --system --no-cache /wheels/arize_phoenix_evals-*.whl \
  && uv pip install --system --no-cache --no-deps /wheels/harbor_verifiers-*.whl
COPY stop_after_skill_load.py /opt/skill-loading/stop_after_skill_load.py
COPY codex_wrapper.py /opt/skill-loading/codex_wrapper.py
RUN mv /usr/local/bin/codex /usr/local/bin/codex-real \
  && install -m 755 /opt/skill-loading/codex_wrapper.py /usr/local/bin/codex
RUN install -d -m 700 /tests
