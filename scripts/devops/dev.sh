#!/bin/bash

# Unified Phoenix Development Environment (Apple container K8s, kind, Docker, Podman)
# Usage: ./dev.sh [command] [--engine container|kind|docker|podman] [--profile NAME]

set -euo pipefail

DEVOPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SELECTED_ENGINE="${PHOENIX_DEV_ENGINE:-}"
FORWARD_ARGS=()
FIRST_CMD=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --engine|--backend)
            if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" =~ ^-- ]]; then
                echo "❌ Engine name required after $1 (container, kind, docker, or podman)" >&2
                exit 1
            fi
            SELECTED_ENGINE="$2"
            shift 2
            ;;
        *)
            if [[ -z "$FIRST_CMD" && ! "$1" =~ ^- ]]; then
                FIRST_CMD="$1"
            fi
            FORWARD_ARGS+=("$1")
            shift
            ;;
    esac
done

# Auto-detect engine when not explicitly specified:
# 1. Apple `container` (Kubernetes) if installed
# 2. Running Docker or Podman daemon (Compose)
# 3. `kind` (Kubernetes) if installed
# 4. Installed Docker or Podman CLI (Compose)
if [[ -z "$SELECTED_ENGINE" || "$SELECTED_ENGINE" == "auto" ]]; then
    if [[ "$FIRST_CMD" == "kubectl" ]]; then
        SELECTED_ENGINE="k8s"
    elif command -v container >/dev/null 2>&1; then
        SELECTED_ENGINE="container"
    elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        SELECTED_ENGINE="docker"
    elif command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
        SELECTED_ENGINE="podman"
    elif command -v kind >/dev/null 2>&1; then
        SELECTED_ENGINE="kind"
    elif command -v docker >/dev/null 2>&1; then
        SELECTED_ENGINE="docker"
    elif command -v podman >/dev/null 2>&1; then
        SELECTED_ENGINE="podman"
    else
        SELECTED_ENGINE="container"
    fi
fi

if [[ -z "$FIRST_CMD" || "$FIRST_CMD" == "help" || "$FIRST_CMD" == "--help" || "$FIRST_CMD" == "-h" ]]; then
    cat <<EOF
Phoenix Unified Development Environment (active engine: ${SELECTED_ENGINE})

🚀 Commands:
  up [--profile NAME]               Build changed images and start services (DEFAULT)
  rebuild [--profile NAME]          Full no-cache rebuild and restart
  down                              Stop services (preserves volumes / PVCs)
  destroy [-y|--yes]                Wipe all persistent data volumes / PVCs
  reset                             Remove built devops images (rebuild on next 'up')
  prune                             Clean image builder cache
  clean [-y|--yes]                  Full cleanup (deletes K8s cluster or prunes Compose engine)
  seed [--scale N]                  Fill PostgreSQL with performance test data (scale 1 = 1.94M spans)
  seed-tail                         Add fresh traffic to seeded busy projects
  psql                              Open psql in PostgreSQL (or pipe SQL to it)
  doctor [--profile NAME]           Diagnose engine, manifests/compose config, ports, and images
  status                            Show running services/pods and active URLs
  profiles                          List available profiles
  env                               Print PHOENIX_* environment variables from Phoenix
  kubectl <args...>                 Run kubectl in the devops namespace (K8s engines only)

⚙️  Engine Selection (env PHOENIX_DEV_ENGINE or --engine):
  container                         Kubernetes via Apple container cluster (default on macOS 26+)
  kind                              Kubernetes via kind
  docker                            Docker Compose
  podman                            Podman Compose

🏷️  Profiles (--profile NAME or --profiles NAME1,NAME2):
  (none)                            Phoenix + PostgreSQL + OIDC + SMTP + Traefik
  vite                              Enable Vite dev server with hot reload
  grafana                           Grafana + Prometheus + Tempo + Loki + OTel Collector
  lgtm                              All-in-one grafana/otel-lgtm + read-only Grafana MCP
  mock-llm                          Mock OpenAI / Anthropic / Gemini / TypeSafe server
  datagen                           Replay synthetic traces into Phoenix
  toxiproxy                         Simulate PostgreSQL network latency / faults
  basic-auth                        Enable username/password login
  in-memory                         In-memory SQLite database
  pkce-public                       OIDC PKCE Public Client + Grafana
  pkce-confidential                 OIDC PKCE Confidential Client + Grafana
  ldap / ldap-no-email / ldap-posix Mock OpenLDAP authentication modes
  ldap-test                         Adversarial LDAP TLS + POSIX test suite
  schema=NAME                       Custom PostgreSQL schema

🌐 Access:
  Phoenix:       http://localhost:18273/phoenix/
  Mail:          http://localhost:18273/mail/
  Database:      localhost:5433 (postgres/postgres)
EOF
    exit 0
fi

case "$SELECTED_ENGINE" in
    container|apple-container)
        export PHOENIX_DEV_ENGINE="container"
        export DEVOPS_K8S_BACKEND="apple-container"
        exec bash "$DEVOPS_DIR/k8s/engine.sh" ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"}
        ;;
    kind)
        export PHOENIX_DEV_ENGINE="kind"
        export DEVOPS_K8S_BACKEND="kind"
        exec bash "$DEVOPS_DIR/k8s/engine.sh" ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"}
        ;;
    k8s|kubernetes)
        export PHOENIX_DEV_ENGINE="k8s"
        exec bash "$DEVOPS_DIR/k8s/engine.sh" ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"}
        ;;
    docker|podman|compose)
        export PHOENIX_DEV_ENGINE="$SELECTED_ENGINE"
        exec bash "$DEVOPS_DIR/compose/engine.sh" ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"}
        ;;
    *)
        echo "❌ Unknown engine '$SELECTED_ENGINE'. Expected one of: container, kind, k8s, docker, podman, compose" >&2
        exit 1
        ;;
esac
