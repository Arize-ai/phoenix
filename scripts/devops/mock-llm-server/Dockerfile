# Multi-stage build for optimal image size and security
FROM node:22-slim AS builder

# Enable pnpm at the version pinned by packageManager
RUN corepack enable

WORKDIR /app

# Copy package files. ``pnpm-lock.yaml*`` (with trailing glob) tolerates the
# lockfile being absent; pnpm install falls back to a fresh resolve.
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY dashboard/package.json ./dashboard/

RUN pnpm install

# Copy sources and build the server and dashboard.
# DASHBOARD_BASE matches the Traefik path; the host build leaves it unset.
COPY tsconfig.json ./
COPY src/ ./src/
COPY dashboard/ ./dashboard/
ENV DASHBOARD_BASE=/mock-llm/dashboard/
RUN pnpm run build:all

# Final runtime stage
FROM node:22-slim AS runtime

# Create app user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

WORKDIR /app

COPY --chown=nodejs:nodejs package.json ./

# Keep all dependencies: fake data generation imports json-schema-faker,
# which is a dev dependency
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dashboard/dist ./dashboard/dist

USER nodejs

ENV NODE_ENV=production
ENV PORT=57593

EXPOSE 57593

CMD ["node", "dist/server.js"]
