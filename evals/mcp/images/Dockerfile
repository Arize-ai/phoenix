FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 git curl ca-certificates ripgrep jq && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/local/bin/python && mkdir -p /workspace && chown node:node /workspace
WORKDIR /workspace

FROM base AS claude-mcp
ARG CLAUDE_VERSION
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION}
FROM claude-mcp AS claude-cli
COPY cli.py /opt/cli.py
RUN printf '#!/bin/sh\nexec python /opt/cli.py "$@"\n' > /usr/local/bin/px && chmod 755 /usr/local/bin/px

FROM base AS codex-mcp
ARG CODEX_VERSION
RUN npm install -g @openai/codex@${CODEX_VERSION}
FROM codex-mcp AS codex-cli
COPY cli.py /opt/cli.py
RUN printf '#!/bin/sh\nexec python /opt/cli.py "$@"\n' > /usr/local/bin/px && chmod 755 /usr/local/bin/px

FROM base AS cli-broker
ARG PX_VERSION
RUN npm install -g @arizeai/phoenix-cli@${PX_VERSION}
COPY cli.py /opt/cli.py
USER node
ENTRYPOINT ["python", "/opt/cli.py", "--serve"]

FROM base AS verifier
COPY verify.py grading.py /tests/
COPY tasks/ /tests/tasks/
RUN printf '#!/bin/sh\nset -eu\npython /tests/verify.py\n' > /tests/test.sh

FROM base AS gateway
COPY gateway.py /opt/gateway.py
ENTRYPOINT ["python", "/opt/gateway.py"]

FROM python:3.13-slim-bookworm@sha256:ed86c82274b3c69b52fb5820f358f0bd7df0b603332063cb5c6e32bd220c3e6e AS target
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl
COPY target.py seed_target.py fixture.py references.py pricing.json /opt/benchmark/
RUN mkdir /data
ENV PHOENIX_WORKING_DIR=/data PHOENIX_TELEMETRY_ENABLED=false PHOENIX_DISABLE_AGENT_ASSISTANT=true
ENTRYPOINT ["python", "/opt/benchmark/target.py"]
