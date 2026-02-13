# 3-stage build with frontend assets for production mode (no-vite)
# This Dockerfile is used when vite-dev service is disabled
ARG PYTHON_VERSION=3.13
ARG NODE_VERSION=22

# Stage 1: Frontend Builder
FROM node:${NODE_VERSION}-slim AS frontend-builder
WORKDIR /phoenix/app
# Copy only package files first for better dependency caching
COPY ./app/package*.json ./app/pnpm-lock.yaml ./
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
RUN pip install uv==0.9.18

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
RUN find src/ -xtype l -delete && \
    uv build && \
    uv pip install dist/*.whl --no-deps

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

# Copy Python environment
COPY --from=backend-builder /phoenix/.venv ./.venv

# Copy built frontend from frontend builder to correct location  
COPY --from=frontend-builder /phoenix/src/phoenix/server/static/ ./.venv/lib/python3.13/site-packages/phoenix/server/static/

# Environment setup
ENV PYTHONPATH="/phoenix/.venv/lib/python3.13/site-packages"
ENV PYTHONUNBUFFERED=1

# Create VS Code configuration for debugging
RUN mkdir -p /phoenix/.venv/lib/python3.13/site-packages/phoenix/.vscode
COPY scripts/docker/devops/vscode-config/launch.json /phoenix/.venv/lib/python3.13/site-packages/phoenix/.vscode/launch.json
COPY scripts/docker/devops/vscode-config/phoenix-debug.code-workspace /root/phoenix-debug.code-workspace

# Expose ports
EXPOSE 6006 4317 9090

# Default command
CMD ["/usr/local/bin/start-phoenix.sh"]
