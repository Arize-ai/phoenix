# Multi-stage build for optimal image size and security
FROM node:22-slim AS builder

# Enable pnpm
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN pnpm install

# Copy backend source and build backend first (changes less frequently)
COPY src/ ./src/
COPY tsconfig.json ./
RUN pnpm build

# Install frontend dependencies (cached if package.json unchanged)
RUN cd frontend && pnpm install

# Copy frontend source separately to maximize cache efficiency  
COPY frontend/src/ ./frontend/src/
COPY frontend/index.html ./frontend/
COPY frontend/vite.config.ts ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/

# Build frontend (this layer will rebuild when frontend source changes)
RUN cd frontend && pnpm build

# Install only production dependencies
RUN pnpm install --prod

# Final runtime stage
FROM node:22-slim AS runtime

# Enable pnpm
RUN corepack enable

# Create app user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs

# Set working directory
WORKDIR /app

# Copy package.json for runtime metadata
COPY --chown=nodejs:nodejs package*.json ./

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist-frontend ./dist-frontend

# Switch to non-root user
USER nodejs

# Expose OIDC HTTP port
EXPOSE 9000

# Set environment variables
ENV NODE_ENV=production

# Start server
CMD ["pnpm", "start"]