FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 git curl ca-certificates ripgrep jq && rm -rf /var/lib/apt/lists/*
RUN ln -s /usr/bin/python3 /usr/local/bin/python && mkdir -p /workspace && chown node:node /workspace
WORKDIR /workspace

FROM base AS claude-mcp
RUN npm install -g @anthropic-ai/claude-code@2.1.267
FROM claude-mcp AS claude-cli
RUN npm install -g @arizeai/phoenix-cli@1.18.1

FROM base AS codex-mcp
RUN npm install -g @openai/codex@0.154.0
FROM codex-mcp AS codex-cli
RUN npm install -g @arizeai/phoenix-cli@1.18.1

FROM base AS verifier
COPY verify.py isolation.py smoke_verify.py /tests/
RUN printf '#!/bin/sh\nset -eu\npython /tests/smoke_verify.py\n' > /tests/test.sh

FROM base AS gateway
COPY smoke_gateway.py /opt/smoke_gateway.py
ENTRYPOINT ["python", "/opt/smoke_gateway.py"]
