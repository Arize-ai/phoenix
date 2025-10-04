# Vite Development Server
# Separate container for hot-reload frontend development

FROM node:22-slim

WORKDIR /app

# Install pnpm
RUN npm i -g corepack && corepack enable

# Copy package files for dependency installation
COPY ./app/package.json ./app/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Create Docker-specific Vite config that extends the base config
# Create it in a hidden directory that will be excluded by anonymous volume
RUN mkdir -p /app/.vite-config && cat > /app/.vite-config/vite.config.mts << 'EOF'
import { defineConfig } from "vite";
import baseConfig from "../vite.config.mts";

export default defineConfig((env) => {
  const config = baseConfig(env);
  
  // Override server config for Docker environment with polling
  config.server = {
    ...config.server,
    hmr: process.env.VITE_HMR_CLIENT_PORT
      ? { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) }
      : true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
  };
  
  return config;
});
EOF

# The source code will be mounted as a volume for hot reload

# Expose Vite dev server port (internal to Docker network only)
EXPOSE 5173

# Start Vite dev server using Docker-specific config
# Config is driven by env vars (VITE_HMR_CLIENT_PORT) set in docker-compose
CMD sh -c "pnpm run build:static && pnpm run build:relay && pnpm exec vite --config .vite-config/vite.config.mts --host 0.0.0.0 --base /phoenix/vite/"
