# Multi-stage build for optimal image size and security
FROM node:22-slim AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY ui/package.json ./ui/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Install UI dependencies
RUN cd ui && pnpm install

# Copy source code and build
COPY . .
RUN pnpm run build

# Keep all dependencies for development debugging
RUN pnpm install

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
COPY --chown=nodejs:nodejs package.json ./

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/ui/dist ./ui/dist

# Create runtime directory for any temporary files
RUN mkdir -p /app/runtime && chown nodejs:nodejs /app/runtime

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 1025 8025

# Start the application
CMD ["node", "dist/server.js"]
