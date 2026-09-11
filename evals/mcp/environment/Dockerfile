FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 git curl ca-certificates ripgrep jq && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/local/bin/python && mkdir -p /workspace
WORKDIR /workspace

# Harbor's built-in adapters use these installed versions without downloading tools.
FROM base AS agent-mcp
ARG CLAUDE_VERSION
ARG CODEX_VERSION
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_VERSION} @openai/codex@${CODEX_VERSION}
COPY environment/probe.py /opt/benchmark/probe.py
ENTRYPOINT ["python", "/opt/benchmark/probe.py"]

FROM agent-mcp AS agent-cli
ARG PX_VERSION
RUN npm install -g @arizeai/phoenix-cli@${PX_VERSION}

FROM base AS gateway
COPY environment/gateway.py /opt/benchmark/gateway.py
ENTRYPOINT ["python", "/opt/benchmark/gateway.py"]

FROM base AS verifier
COPY scoring/ /opt/benchmark/evals/mcp/scoring/
COPY tasks/ /opt/benchmark/evals/mcp/tasks/
RUN mkdir /tests && printf '#!/bin/sh\nset -eu\npython -m evals.mcp.scoring.verify --task "$BENCHMARK_TASK" --interface "$BENCHMARK_INTERFACE"\n' > /tests/test.sh
ENV PYTHONPATH=/opt/benchmark

FROM python:3.13-slim-bookworm@sha256:ed86c82274b3c69b52fb5820f358f0bd7df0b603332063cb5c6e32bd220c3e6e AS target
COPY wheels/ /wheels/
RUN pip install --no-cache-dir /wheels/*.whl
COPY environment/server.py environment/seed.py environment/pricing.json /opt/benchmark/evals/mcp/environment/
COPY scoring/references.py /opt/benchmark/evals/mcp/scoring/references.py
COPY environment/start.sh /opt/benchmark/start.sh
RUN mkdir /data /evidence
ENV PYTHONPATH=/opt/benchmark PHOENIX_WORKING_DIR=/data PHOENIX_TELEMETRY_ENABLED=false PHOENIX_DISABLE_AGENT_ASSISTANT=true
ENTRYPOINT ["sh", "/opt/benchmark/start.sh"]
