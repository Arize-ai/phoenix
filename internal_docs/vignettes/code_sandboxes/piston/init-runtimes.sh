#!/usr/bin/env bash
# Waits for Piston to be ready, then installs the Python runtime.
# Run this once after `docker compose up -d piston`.

set -euo pipefail

PISTON_URL="${PISTON_URL:-http://localhost:2000}"

echo "⏳  Waiting for Piston at ${PISTON_URL}…"
for i in $(seq 1 30); do
  if curl -sf "${PISTON_URL}/api/v2/runtimes" -o /dev/null 2>&1; then
    echo "✅  Piston is up (attempt ${i})"
    break
  fi
  echo "   attempt ${i}/30 — sleeping 3s"
  sleep 3
done

echo ""
echo "📦  Installing Python…"
curl -sf -X POST "${PISTON_URL}/api/v2/packages" \
  -H 'Content-Type: application/json' \
  -d '{"language": "python", "version": "*"}'

echo ""
echo "🐍  Installed runtimes:"
curl -sf "${PISTON_URL}/api/v2/runtimes" | python3 -c "
import json, sys
for r in json.load(sys.stdin):
    print(f\"  {r['language']:20s} {r['version']}\")
" 2>/dev/null || curl -sf "${PISTON_URL}/api/v2/runtimes"

echo ""
echo "Done! Open http://localhost:5000"
