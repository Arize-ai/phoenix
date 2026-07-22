# 3-stage build with frontend assets for production mode (no-vite)
# This Dockerfile is used when vite-dev service is disabled
ARG PYTHON_VERSION=3.13
ARG NODE_VERSION=22

# Stage 1: Frontend Builder
FROM node:${NODE_VERSION}-slim AS frontend-builder
WORKDIR /phoenix/app
# Copy only package files first for better dependency caching
COPY ./app/package*.json ./app/pnpm-lock.yaml ./app/pnpm-workspace.yaml ./app/.pnpmfile.cjs ./
# Install dependencies
RUN npm i -g corepack && \
    corepack enable && \
    pnpm install --frozen-lockfile
# Copy source and build
COPY ./app ./
# Create directory structure that vite expects
RUN mkdir -p /phoenix/src/phoenix/server/static
RUN pnpm build

# Stage 2: Backend Builder  
FROM python:${PYTHON_VERSION}-slim-bullseye AS backend-builder
WORKDIR /phoenix

# Install uv - pin version to match pyproject.toml [tool.uv] required-version
RUN pip install uv==0.11.12

# Copy dependency files first for better layer caching
COPY ./pyproject.toml ./uv.lock ./LICENSE ./IP_NOTICE ./README.md ./

# Copy only essential files needed for dependency resolution and version detection
COPY ./src/phoenix/__init__.py ./src/phoenix/version.py ./src/phoenix/

# Install dependencies first (this layer will be cached)
# --no-sources ignores workspace member references that don't exist in Docker context
RUN uv sync \
  --no-dev \
  --no-install-project \
  --no-sources \
  --extra container \
  --extra pg

# Install debugpy for development (not in pyproject.toml)
RUN uv pip install debugpy

# Copy actual source code (this layer changes more frequently)
COPY ./src ./src

# Build and install Phoenix with the real source code (fast since deps are cached)
# Remove broken symlinks (workspace packages not in Docker context), then build a wheel
# Flatten site-packages into /phoenix/env so the runtime stage has no version-specific paths
RUN find src/ -xtype l -delete && \
    uv build && \
    uv pip install dist/*.whl --no-deps && \
    cp -a .venv/lib/python*/site-packages/ /phoenix/env/

# Pre-download the CPython WASM binary so the WASM sandbox provider works
# without network egress at runtime. Same URL/filename/sha256 as the
# production Dockerfile — keep in sync with
# src/phoenix/server/sandbox/_download.py (_WASM_URL / _WASM_FILENAME /
# _WASM_SHA256); PHOENIX_WASM_BINARY_PATH (set in the runtime stage) is
# the authoritative resolver hook consumed by ensure_wasm_binary(). The
# sha256 assertion guards against upstream release-asset tampering — TLS
# alone is not enough for a binary that executes user code in the sandbox.
RUN mkdir -p /wasm \
  && python -c "import hashlib, sys, urllib.request; \
url = 'https://github.com/vmware-labs/webassembly-language-runtimes/releases/download/python%2F3.12.0%2B20231211-040d5a6/python-3.12.0.wasm'; \
dest = '/wasm/python-3.12.0.wasm'; \
expected = 'e5dc5a398b07b54ea8fdb503bf68fb583d533f10ec3f930963e02b9505f7a763'; \
urllib.request.urlretrieve(url, dest); \
actual = hashlib.sha256(open(dest, 'rb').read()).hexdigest(); \
(actual == expected) or sys.exit(f'SHA-256 mismatch for {dest}: expected {expected}, got {actual}')"

# Bundle the Deno runtime so the local DENO sandbox provider works inside
# the runtime image. denoland/deno:bin-<version> is a scratch-based image
# that contains a single statically-linked /deno binary, safe to COPY
# into the runtime stage. Pinning the version (NOT :latest) keeps builds
# reproducible and matches the production Dockerfile pin.
FROM denoland/deno:bin-2.1.4 AS deno-binary

# Stage 3: Runtime (combines everything)
FROM python:${PYTHON_VERSION}-slim-bullseye AS runtime
WORKDIR /phoenix

# Install only essential system dependencies for runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    netcat-openbsd \
    socat \
    curl \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

# Copy startup script
COPY --chmod=755 scripts/docker/devops/scripts/start-phoenix.sh /usr/local/bin/start-phoenix.sh

# Copy Python environment (version-independent flat directory)
COPY --from=backend-builder /phoenix/env ./env

# Copy built frontend from frontend builder to correct location
COPY --from=frontend-builder /phoenix/src/phoenix/server/static/ ./env/phoenix/server/static/

# Bundled local sandbox runtimes (Deno + CPython WASM). Mirrors the
# production Dockerfile so devops images behave the same as shipped
# containers for the local sandbox providers. /usr/local/bin is on the
# default PATH for python:slim-bullseye, so shutil.which("deno") in
# deno_backend.py resolves the bundled binary.
COPY --chmod=755 --from=deno-binary /deno /usr/local/bin/deno
COPY --from=backend-builder /wasm/python-3.12.0.wasm /opt/phoenix/wasm/python-3.12.0.wasm
ENV PHOENIX_WASM_BINARY_PATH=/opt/phoenix/wasm/python-3.12.0.wasm

# Environment setup
ENV PYTHONPATH="/phoenix/env"
ENV PYTHONUNBUFFERED=1

# Create VS Code configuration for debugging
RUN mkdir -p /phoenix/env/phoenix/.vscode
COPY scripts/docker/devops/vscode-config/launch.json /phoenix/env/phoenix/.vscode/launch.json
COPY scripts/docker/devops/vscode-config/phoenix-debug.code-workspace /root/phoenix-debug.code-workspace

# Expose ports
EXPOSE 6006 4317 9090

# Default command
CMD ["/usr/local/bin/start-phoenix.sh"]
