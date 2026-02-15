#!/bin/bash
set -e

# Parse flags
VERBOSE=false
if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
  VERBOSE=true
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${GRAY}$1${NC}"
  fi
}

log_info() {
  echo -e "${GREEN}$1${NC}"
}

log_warn() {
  echo -e "${YELLOW}$1${NC}"
}

log_error() {
  echo -e "${RED}$1${NC}"
}

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  log_warn "Warning: Docker is not available"
  echo "Phoenix tracing will be disabled or use PHOENIX_COLLECTOR_ENDPOINT if set"
  echo "To enable local Phoenix, start Docker and run: pnpm phoenix:start"
  exit 0
fi

# Check if Phoenix container is running
if docker ps --format '{{.Names}}' | grep -q "^cli-agent-phoenix$"; then
  log_verbose "Phoenix container is already running"

  # Wait for health check (silently)
  timeout=60
  elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if curl -f http://localhost:6006/healthz > /dev/null 2>&1; then
      log_verbose "✓ Phoenix is healthy (http://localhost:6006)"
      exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  log_warn "Warning: Phoenix container is running but not responding"
  echo "Try: pnpm phoenix:restart"
  exit 0
fi

# Check if Phoenix container exists but is stopped
if docker ps -a --format '{{.Names}}' | grep -q "^cli-agent-phoenix$"; then
  log_info "Starting Phoenix..."
  docker compose start phoenix > /dev/null 2>&1
else
  log_info "Starting Phoenix (first run may take ~30s)..."
  docker compose up -d phoenix > /dev/null 2>&1
fi

# Wait for Phoenix to be healthy
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
  if curl -f http://localhost:6006/healthz > /dev/null 2>&1; then
    log_info "✓ Phoenix ready → http://localhost:6006"
    exit 0
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  if [ "$VERBOSE" = true ]; then
    echo -n "."
  fi
done

if [ "$VERBOSE" = true ]; then
  echo ""
fi
log_error "Error: Phoenix failed to start"
echo "Check logs: pnpm phoenix:logs"
exit 1
