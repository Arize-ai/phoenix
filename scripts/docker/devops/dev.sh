#!/bin/bash

# Phoenix Development Environment with Native Docker Compose Profiles
# Usage: ./dev.sh [command] [options]

set -e

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEV_DIR"

# Constants
readonly PROJECT_NAME="devops"
readonly HEALTH_URL="http://localhost:18273/phoenix/healthz"
readonly HEALTH_TIMEOUT=60
readonly HEALTH_LOG_CHECK=15
readonly DATAGEN_STATE_URL="http://localhost:18273/datagen/api/state"
readonly DATAGEN_TIMEOUT=120

# Global variables
CURRENT_PROFILES=""
CURRENT_SCHEMA=""
COMPOSE_FILES="-f docker-compose.yml"
PROFILE_FLAGS=""
COMMAND=""
COMPOSE_BIN=()

# Logging helpers
log_info() { echo "🔵 $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }

# Prefer the Compose plugin (`docker compose`); fall back to the standalone binary
detect_compose() {
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_BIN=(docker compose)
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_BIN=(docker-compose)
    else
        COMPOSE_BIN=()
    fi
}

# Check dependencies
check_dependencies() {
    local missing=()
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    detect_compose
    [[ ${#COMPOSE_BIN[@]} -gt 0 ]] || missing+=("docker compose")
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing[*]}"
        echo "Please install: ${missing[*]}"
        echo "Run './dev.sh doctor' for a full environment check"
        exit 1
    fi
}

# Remove each named Docker object, showing failures. Returns 1 if any failed.
remove_each() {
    local kind="$1"
    shift
    local failed=0
    local name
    for name in "$@"; do
        if docker "$kind" rm "$name" >/dev/null; then
            echo "   removed $name"
        else
            failed=1
        fi
    done
    return $failed
}

# Stop all containers for this project
stop_all_containers() {
    local containers
    containers=$(docker ps -aq --filter "label=com.docker.compose.project=${PROJECT_NAME}" 2>/dev/null || true)
    
    if [[ -n "$containers" ]]; then
        echo "$containers" | xargs docker stop >/dev/null 2>&1 || true
        echo "$containers" | xargs docker rm >/dev/null 2>&1 || true
    fi
}

# Get volume names for this project
get_volumes() {
    docker volume ls --format "{{.Name}}" | grep "^${PROJECT_NAME}_" || true
}

# Add a profile to CURRENT_PROFILES
add_profile() {
    local profile="$1"
    
    # Handle dynamic schema profiles
    if [[ "$profile" =~ ^schema= ]]; then
        CURRENT_SCHEMA="${profile#schema=}"
        log_info "Using dynamic schema profile with schema: $CURRENT_SCHEMA"
    fi
    
    # Add profile to the list
    if [[ -z "$CURRENT_PROFILES" ]]; then
        CURRENT_PROFILES="$profile"
    else
        CURRENT_PROFILES="$CURRENT_PROFILES $profile"
    fi
}

# Profile configurations - maps profile names to required override files
get_profile_config() {
    case "$1" in
        "vite")
            echo "override:overrides/vite.yml"
            ;;
        "pkce-public")
            echo "override:overrides/pkce-public.yml"
            ;;
        "pkce-confidential")
            echo "override:overrides/pkce-confidential.yml"
            ;;
        "basic-auth")
            echo "override:overrides/basic-auth.yml"
            ;;
        "in-memory")
            echo "override:overrides/in-memory.yml"
            ;;
        "toxiproxy")
            echo "override:overrides/toxiproxy.yml"
            ;;
        "grafana")
            # Grafana profile doesn't need override - pure profile in main file
            echo "profile"
            ;;
        "mock-llm")
            # Mock LLM profile doesn't need override - pure profile in main file
            echo "profile"
            ;;
        "datagen")
            # Datagen profile doesn't need override - pure profile in main file
            echo "profile"
            ;;
        "ldap")
            echo "override:overrides/ldap.yml"
            ;;
        "ldap-no-email")
            echo "override:overrides/ldap-no-email.yml"
            ;;
        "ldap-posix")
            echo "override:overrides/ldap-posix.yml"
            ;;
        "ldap-test")
            echo "override:overrides/ldap-test.yml"
            ;;
        schema*)
            # Dynamic schema profile
            local schema_name="${1#schema=}"
            generate_schema_override "$schema_name"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Validate PostgreSQL schema name
validate_schema_name() {
    local schema_name="$1"
    
    if [[ -z "$schema_name" ]]; then
        log_error "Schema name cannot be empty"
        return 1
    fi
    
    if [[ ${#schema_name} -gt 63 ]]; then
        log_error "Schema name must be 63 characters or less (got ${#schema_name} characters)"
        return 1
    fi
    
    if [[ ! "$schema_name" =~ ^[a-zA-Z_] ]]; then
        log_error "Schema name must start with a letter or underscore"
        return 1
    fi
    
    if [[ ! "$schema_name" =~ ^[a-zA-Z_][a-zA-Z0-9_$]*$ ]]; then
        log_error "Schema name can only contain letters, digits, underscores, and dollar signs"
        return 1
    fi
    
    local reserved_keywords="user database schema table column index primary key foreign unique check default null not"
    for keyword in $reserved_keywords; do
        if [[ "$schema_name" = "$keyword" ]]; then
            log_error "Schema name '$schema_name' is a reserved PostgreSQL keyword"
            return 1
        fi
    done
    
    return 0
}

# Generate dynamic schema override
generate_schema_override() {
    local schema_name="$1"
    
    if ! validate_schema_name "$schema_name"; then
        log_error "Invalid schema name: $schema_name"
        exit 1
    fi
    
    local temp_override="/tmp/phoenix-schema-override-$$.yml"
    
    cat > "$temp_override" << EOF
services:
  phoenix:
    environment:
      - PHOENIX_SQL_DATABASE_SCHEMA=$schema_name
  
  db:
    deploy:
      replicas: 1
EOF
    
    echo "override:$temp_override"
}

# Cleanup function for temporary files
cleanup() {
    rm -f /tmp/phoenix-schema-override-*.yml 2>/dev/null || true
}
trap cleanup EXIT

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --profile)
                if [[ -z "$2" ]] || [[ "$2" =~ ^-- ]]; then
                    log_error "Profile name required after --profile"
                    exit 1
                fi
                add_profile "$2"
                shift 2
                ;;
            --profiles)
                if [[ -z "$2" ]] || [[ "$2" =~ ^-- ]]; then
                    log_error "Profile list required after --profiles"
                    exit 1
                fi
                # Split comma-separated profiles
                IFS=',' read -ra PROFILE_ARRAY <<< "$2"
                for profile in "${PROFILE_ARRAY[@]}"; do
                    # Trim whitespace
                    profile=$(echo "$profile" | xargs)
                    add_profile "$profile"
                done
                shift 2
                ;;
            *)
                # Store the command for later processing
                if [[ -z "$COMMAND" ]]; then
                    COMMAND="$1"
                fi
                shift
                ;;
        esac
    done
    
    # Build compose command with profiles and overrides
    COMPOSE_FILES="-f docker-compose.yml"
    PROFILE_FLAGS=""
    
    if [[ -n "$CURRENT_PROFILES" ]]; then
        for profile in $CURRENT_PROFILES; do
            local config=$(get_profile_config "$profile")
            
            if [[ "$config" == "unknown" ]]; then
                log_error "Unknown profile: $profile"
                exit 1
            elif [[ "$config" == "profile" ]]; then
                # Pure profile - no override needed
                PROFILE_FLAGS="$PROFILE_FLAGS --profile $profile"
            elif [[ "$config" =~ ^override: ]]; then
                # Needs override file
                local override_file="${config#override:}"
                COMPOSE_FILES="$COMPOSE_FILES -f $override_file"
                PROFILE_FLAGS="$PROFILE_FLAGS --profile $profile"
            fi
        done
    fi
}

# Build docker-compose command as array and execute it
compose_cmd() {
    local cmd=("${COMPOSE_BIN[@]}")
    
    # Add compose files
    local IFS=' '
    for arg in $COMPOSE_FILES; do
        cmd+=("$arg")
    done
    
    # Add profile flags
    for arg in $PROFILE_FLAGS; do
        cmd+=("$arg")
    done
    
    # Execute the command with any additional arguments
    "${cmd[@]}" "$@"
}

# Get docker-compose command as string (for display purposes)
compose_cmd_str() {
    echo "${COMPOSE_BIN[*]} $COMPOSE_FILES $PROFILE_FLAGS"
}

# Wait for Phoenix health check
wait_for_phoenix() {
    echo "⏳ Waiting for Phoenix to be ready..."
    local attempt=1
    
    while [ $attempt -le $HEALTH_TIMEOUT ]; do
        if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
            echo ""
            log_success "Phoenix is ready!"
            return 0
        fi
        
        if [ $attempt -eq 1 ]; then
            echo -n "   Checking health"
        fi
        echo -n "."

        if [ $attempt -eq $HEALTH_LOG_CHECK ]; then
            echo ""
            echo "💡 Phoenix is taking longer than expected. Recent logs:"
            echo "────────────────────────────────────────────────────────"
            local logs
            logs=$(compose_cmd logs phoenix --tail=100 2>&1)
            echo "$logs"
            echo "────────────────────────────────────────────────────────"
            
            if echo "$logs" | grep -qi -E "(exception|traceback|phoenix\.exceptions)"; then
                echo ""
                log_error "Exception detected in Phoenix logs - stopping wait"
                echo "   Phoenix appears to have crashed. Try: ./dev.sh destroy && ./dev.sh up"
                return 1
            fi
            
            echo -n "   Continuing to wait"
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo ""
    log_error "Phoenix health check failed after ${HEALTH_TIMEOUT} seconds"
    echo "   Check logs: $(compose_cmd_str) logs phoenix"
    return 1
}

# Wait for datagen to finish seeding datasets, custom providers, and evaluators
wait_for_datagen() {
    if [[ " $CURRENT_PROFILES " != *" datagen "* ]]; then
        return 0
    fi

    echo "⏳ Waiting for datagen to finish seeding..."
    local attempt=1
    while [ $attempt -le $DATAGEN_TIMEOUT ]; do
        if curl -s -f "$DATAGEN_STATE_URL" 2>/dev/null | grep -q '"phase"[[:space:]]*:[[:space:]]*"replaying"'; then
            echo ""
            log_success "Datagen is replaying!"
            return 0
        fi

        if [ $attempt -eq 1 ]; then
            echo -n "   Seeding"
        fi
        echo -n "."

        sleep 1
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Datagen seeding did not complete within ${DATAGEN_TIMEOUT} seconds"
    echo "   Check logs: $(compose_cmd_str) logs datagen"
    return 1
}

# Show available services
show_services() {
    echo "🌐 Web Services:"
    echo "  Phoenix:    http://localhost:18273/phoenix"
    echo "  Mail:       http://localhost:18273/mail"
    echo ""
    echo "📊 Direct Access:"
    echo "  Database:   localhost:5433 (postgres/postgres)"
    
    if [[ -n "$CURRENT_PROFILES" ]]; then
        echo ""
        echo "🏷️  Active Profiles: $CURRENT_PROFILES"
        for profile in $CURRENT_PROFILES; do
            case "$profile" in
                "pkce-public")
                    echo "  OAuth Mode: PKCE Public Client (no client secret)"
                    ;;
                "pkce-confidential") 
                    echo "  OAuth Mode: PKCE Confidential Client (with client secret)"
                    ;;
                "vite")
                    echo "  Frontend: Development mode (Vite dev server enabled)"
                    ;;
                "in-memory")
                    echo "  Database: In-memory SQLite"
                    ;;
                "toxiproxy")
                    echo "  Database:   Phoenix connects through Toxiproxy (2ms ±1ms by default)"
                    echo "  Controls:   http://localhost:18273/toxiproxy/"
                    ;;
                "grafana")
                    echo "  Monitoring: Grafana + Prometheus enabled"
                    echo "  Grafana:    http://localhost:18273/grafana"
                    echo "  Prometheus: http://localhost:18273/prometheus/"
                    ;;
                "mock-llm")
                    echo "  Mock LLM:   http://mock-llm:57593/v1 (from the Phoenix container)"
                    echo "  Dashboard:  http://localhost:18273/mock-llm/dashboard/"
                    ;;
                "datagen")
                    echo "  Datagen:    replaying traces, one project per recorded application"
                    echo "  Controls:   http://localhost:18273/datagen/"
                    echo "  Logs:       $(compose_cmd_str) logs -f datagen"
                    ;;
                "ldap")
                    echo "  Authentication: LDAP server enabled"
                    echo "  LDAP Admin:     http://localhost:6443 (admin@example.com / admin_password)"
                    echo "  LDAP Tests:     docker logs ${PROJECT_NAME:-devops}-ldap-test"
                    ;;
                "ldap-no-email")
                    echo "  Authentication: LDAP server enabled (no-email mode)"
                    echo "  LDAP Admin:     http://localhost:6443 (admin@example.com / admin_password)"
                    echo "  Email Mode:     null email markers (users identified by entryUUID)"
                    ;;
                "ldap-posix")
                    echo "  Authentication: LDAP server enabled (POSIX groups mode)"
                    echo "  LDAP Admin:     http://localhost:6443 (admin@example.com / admin_password)"
                    echo "  Group Mode:     POSIX (memberUid via GROUP_SEARCH_FILTER, no memberOf)"
                    ;;
                schema*)
                    echo "  Schema: $CURRENT_SCHEMA"
                    ;;
            esac
        done
    fi
}

# Show current status
show_status() {
    log_info "Checking Docker services status..."
    
    if compose_cmd ps --format table 2>/dev/null | grep -q "Up"; then
        log_success "Services are running"
        
        if [[ -n "$CURRENT_PROFILES" ]]; then
            echo ""
            echo "🏷️  Active Profiles: $CURRENT_PROFILES"
        else
            echo ""
            echo "🏷️  Profile: standard (production mode - no Vite dev server)"
        fi
        
        echo ""
        show_services
    else
        log_warning "No services are currently running"
        echo "Use './dev.sh up [--profile PROFILE_NAME]' to start services"
    fi
}

# List available profiles
list_profiles() {
    echo "📋 Available Profiles:"
    echo ""
    echo "  standard           Standard configuration (production mode - no Vite dev server)"
    echo "  vite               Enable Vite dev server (development mode)"
    echo "  pkce-public        PKCE Public Client (no client secret)"
    echo "  pkce-confidential  PKCE Confidential Client (with client secret)"
    echo "  basic-auth         Basic authentication (username/password)"
    echo "  in-memory          In-memory SQLite database"
    echo "  toxiproxy          Enable network simulation with Toxiproxy"
  echo "  grafana            Enable Grafana and Prometheus monitoring"
  echo "  mock-llm           Enable the mock LLM server (OpenAI, Anthropic, Gemini, TypeSafe)"
  echo "  datagen            Replay synthetic traces (one project per application)"
  echo "  ldap               Enable LDAP authentication (mock LDAP server)"
  echo "  ldap-no-email      Enable LDAP authentication (users without email)"
  echo "  ldap-posix         Enable LDAP authentication (POSIX groups, no memberOf)"
  echo "  schema=NAME        Dynamic schema profile (custom database name)"
  echo ""
    echo "Usage:"
    echo "  ./dev.sh up                              # Standard mode (production - no Vite)"
    echo "  ./dev.sh up --profile vite               # Enable Vite dev server"
    echo "  ./dev.sh up --profile pkce-public        # PKCE public client"
    echo "  ./dev.sh up --profile pkce-confidential  # PKCE confidential client"
    echo "  ./dev.sh up --profile basic-auth         # Basic authentication"
    echo "  ./dev.sh up --profile in-memory          # In-memory SQLite database"
    echo "  ./dev.sh up --profile toxiproxy          # Enable network simulation"
  echo "  ./dev.sh up --profile grafana            # Enable Grafana monitoring"
  echo "  ./dev.sh up --profile mock-llm           # Enable the mock LLM server"
  echo "  ./dev.sh up --profile datagen            # Replay synthetic traces"
  echo "  ./dev.sh up --profile ldap               # Enable LDAP authentication"
  echo "  ./dev.sh up --profile ldap-no-email      # LDAP without email addresses"
  echo "  ./dev.sh up --profile ldap-posix         # LDAP with POSIX groups"
  echo "  ./dev.sh up --profile schema=myapp       # Custom schema 'myapp'"
  echo "  ./dev.sh up --profiles vite,grafana      # Multiple profiles"
}

# Report whether a host TCP port is free or held by this project's containers
check_port() {
    local port="$1"
    local purpose="$2"
    local listening=""
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && listening=1
    elif command -v nc >/dev/null 2>&1; then
        nc -z localhost "$port" >/dev/null 2>&1 && listening=1
    else
        log_warning "Port $port ($purpose): cannot check (install lsof or nc)"
        return 0
    fi

    if [[ -z "$listening" ]]; then
        log_success "Port $port ($purpose) is free"
    elif docker ps --filter "label=com.docker.compose.project=${PROJECT_NAME}" --format '{{.Ports}}' 2>/dev/null | grep -q ":${port}->"; then
        log_success "Port $port ($purpose) is in use by this stack"
    else
        log_error "Port $port ($purpose) is in use by another process"
        echo "   Find it with: lsof -nP -iTCP:$port -sTCP:LISTEN"
        DOCTOR_FAILED=1
    fi
}

# Flag images older than their build context, and containers running a
# superseded image. Source files are the git-tracked and untracked-unignored
# files in each build context.
check_image_freshness() {
    if ! command -v python3 >/dev/null 2>&1; then
        log_warning "python3 not found; skipping image freshness check"
        return 0
    fi
    local config
    if ! config=$(compose_cmd config --format json 2>/dev/null); then
        log_warning "Could not read compose config; skipping image freshness check"
        return 0
    fi
    # PROJECT_NAME is readonly, and assigning to it as a command prefix aborts the script.
    COMPOSE_JSON="$config" DEVOPS_PROJECT="$PROJECT_NAME" python3 - <<'PY' || DOCTOR_WARNED=1
import json, os, subprocess, sys
from datetime import datetime

def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None

def parse_time(value):
    # Docker reports nanoseconds; datetime accepts at most microseconds
    head, _, frac = value.rstrip("Z").partition(".")
    return datetime.fromisoformat(f"{head}.{(frac or '0')[:6]}+00:00").timestamp()

config = json.loads(os.environ["COMPOSE_JSON"])
project = config.get("name") or os.environ["DEVOPS_PROJECT"]
stale = False
for name, service in sorted(config.get("services", {}).items()):
    build = service.get("build")
    if not build:
        continue
    image = service.get("image") or f"{project}-{name}"
    created = run("docker", "image", "inspect", "-f", "{{.Created}}", image)
    if created is None:
        print(f"🔵 {name}: no image yet; 'up' will build it")
        continue
    built_at = parse_time(created)
    context = build["context"]
    files = run("git", "-C", context, "ls-files", "-co", "--exclude-standard", "--full-name", ".")
    root = run("git", "-C", context, "rev-parse", "--show-toplevel")
    changed = []
    for rel in (files or "").splitlines():
        path = os.path.join(root, rel)
        try:
            if os.path.getmtime(path) > built_at:
                changed.append(rel)
        except OSError:
            pass
    if changed:
        stale = True
        print(f"⚠️  {name}: image is older than {len(changed)} source file(s), e.g. {changed[0]}")
        print("   Fix: ./dev.sh up (rebuilds changed images)")
    else:
        print(f"✅ {name}: image is up to date with its source")

    image_id = run("docker", "image", "inspect", "-f", "{{.Id}}", image)
    containers = run(
        "docker", "ps", "-q",
        "--filter", f"label=com.docker.compose.project={project}",
        "--filter", f"label=com.docker.compose.service={name}",
    )
    for container in (containers or "").split():
        if run("docker", "inspect", "-f", "{{.Image}}", container) != image_id:
            stale = True
            print(f"⚠️  {name}: running container uses an older image than {image}")
            print("   Fix: ./dev.sh up (recreates it)")
sys.exit(1 if stale else 0)
PY
}

# Diagnose the most common setup problems
run_doctor() {
    DOCTOR_FAILED=0
    DOCTOR_WARNED=0
    echo "🩺 Checking the development environment..."
    echo ""

    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker CLI not found. Install Docker Desktop: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_success "Docker CLI found"

    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not reachable. Start Docker Desktop and retry."
        exit 1
    fi
    log_success "Docker daemon is running"

    if [[ ${#COMPOSE_BIN[@]} -eq 0 ]]; then
        log_error "Docker Compose not found. Install the Compose plugin: https://docs.docker.com/compose/install/"
        exit 1
    fi
    log_success "Compose found: ${COMPOSE_BIN[*]}"

    if compose_cmd config -q; then
        log_success "Compose config is valid ($(compose_cmd_str))"
    else
        log_error "Compose config is invalid (see errors above)"
        DOCTOR_FAILED=1
    fi

    command -v curl >/dev/null 2>&1 && log_success "curl found" || {
        log_error "curl not found; 'up' needs it for the Phoenix health check"
        DOCTOR_FAILED=1
    }

    echo ""
    check_port 18273 "Traefik: Phoenix, mail, OIDC, mock LLM, datagen, Toxiproxy"
    check_port 5433 "PostgreSQL"

    echo ""
    check_image_freshness

    echo ""
    if [[ $DOCTOR_FAILED -eq 0 && $DOCTOR_WARNED -eq 0 ]]; then
        log_success "No problems found"
    elif [[ $DOCTOR_FAILED -eq 0 ]]; then
        log_warning "Some images are out of date; './dev.sh up' rebuilds them"
    else
        log_error "Problems found; see the fixes above"
        exit 1
    fi
}

# Parse arguments first
parse_args "$@"

# doctor reports missing dependencies itself; help needs none
case "${COMMAND:-help}" in
    doctor|help) detect_compose ;;
    *) check_dependencies ;;
esac

# Main commands
case "${COMMAND:-help}" in
    "up")
        if [[ -n "$CURRENT_PROFILES" ]]; then
            log_info "Starting Phoenix development environment with profiles: $CURRENT_PROFILES"
        else
            log_info "Starting Phoenix development environment (standard mode)"
        fi
        
        echo "📦 Building changed images and starting all services..."
        compose_cmd up -d --build
        
        if wait_for_phoenix && wait_for_datagen; then
            log_success "Environment ready!"
            show_services
        else
            log_error "Failed to start Phoenix environment"
            exit 1
        fi
        ;;
    
    "rebuild")
        if [[ -n "$CURRENT_PROFILES" ]]; then
            log_info "Force rebuilding Phoenix with profiles: $CURRENT_PROFILES"
        else
            log_info "Force rebuilding Phoenix (standard mode)"
        fi
        
        DOCKER_BUILDKIT=1 compose_cmd build --no-cache
        echo "📦 Starting all services..."
        compose_cmd up -d --force-recreate
        
        if wait_for_phoenix && wait_for_datagen; then
            log_success "Environment ready!"
            show_services
        else
            log_error "Failed to start Phoenix environment"
            exit 1
        fi
        ;;
    
    "down")
        log_info "Stopping environment..."
        stop_all_containers
        log_success "All services stopped"
        ;;

    "destroy")
        log_warning "Destroying all data (postgres, grafana, prometheus)..."
        log_warning "This will permanently delete all database data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping all services..."
            stop_all_containers
            
            log_info "Removing data volumes..."
            VOLUMES=$(get_volumes)
            if [[ -z "$VOLUMES" ]]; then
                log_warning "No volumes found to remove"
            elif remove_each volume $VOLUMES; then
                log_success "All data destroyed! Run './dev.sh up' to start fresh."
                echo "   Images are kept; 'up' rebuilds any whose source changed."
            else
                log_error "Some volumes could not be removed (see errors above)"
                exit 1
            fi
        else
            log_error "Operation cancelled."
        fi
        ;;

    "reset")
        log_info "Resetting all images (will rebuild on next 'up' command)..."
        log_info "Stopping all services..."
        stop_all_containers
        
        log_info "Removing all images..."
        # Get images for this project
        IMAGES=$(docker images --format "{{.Repository}}" | grep "^${PROJECT_NAME}-" || true)
        if [[ -z "$IMAGES" ]]; then
            log_warning "No project images found to remove"
        elif remove_each image $IMAGES; then
            log_success "All images removed! Run './dev.sh up' to rebuild and start."
        else
            log_error "Some images could not be removed (see errors above)"
            exit 1
        fi
        ;;

    "prune")
        log_info "Cleaning up Docker build cache..."
        CACHE_SIZE=$(docker system df -v 2>/dev/null | grep "Build cache usage" | awk '{print $4}' || echo "unknown")
        echo "   Current build cache size: $CACHE_SIZE"
        
        if docker builder prune -a -f >/dev/null 2>&1; then
            log_success "Build cache cleaned!"
            CACHE_SIZE=$(docker system df -v 2>/dev/null | grep "Build cache usage" | awk '{print $4}' || echo "0B")
            echo "   New build cache size: $CACHE_SIZE"
        else
            log_error "Failed to clean build cache"
        fi
        ;;

    "clean")
        log_warning "Full Docker cleanup: images, containers, volumes, build cache, and networks"
        log_warning "This will remove EVERYTHING Docker-related (not just this project)!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping project services..."
            stop_all_containers
            
            log_info "Running full Docker system cleanup..."
            docker system prune -a --volumes -f
            
            log_success "Full cleanup complete! Disk space recovered."
            echo "   Run './dev.sh up' to start fresh."
        else
            log_error "Operation cancelled."
        fi
        ;;

    "status")
        show_status
        ;;

    "profiles")
        list_profiles
        ;;

    "doctor")
        run_doctor
        ;;

    "env")
        # Check if Phoenix container is running
        if ! compose_cmd ps phoenix | grep -q "Up"; then
            log_error "Phoenix container is not running" >&2
            echo "Use './dev.sh up' to start the Phoenix container first" >&2
            exit 1
        fi
        
        # Get container name
        container_name=$(compose_cmd ps -q phoenix)
        if [[ -z "$container_name" ]]; then
            log_error "Could not find Phoenix container" >&2
            exit 1
        fi
        
        # Extract environment variables with PHOENIX_ prefix
        env_vars=$(docker exec "$container_name" env | grep '^PHOENIX_' | sort)
        
        if [[ -n "$env_vars" ]]; then
            echo "$env_vars"
        else
            log_warning "No environment variables found in Phoenix container" >&2
        fi
        ;;

    "help"|""|*)
        cat << 'EOF'
Phoenix Development Environment

🚀 Commands:
  up [--profile NAME]      Build changed images and start services (DEFAULT)
  rebuild [--profile NAME] Full rebuild without cache (slowest)
  down                     Stop all services  
  reset                    Remove all images (rebuild on next 'up')
  destroy                  Wipe data volumes (database, grafana, prometheus); keeps images
  doctor [--profile NAME]  Check Docker, ports, compose config, and image freshness
  prune                    Clean Docker build cache (frees disk space)
  clean                    Full Docker cleanup (WARNING: removes everything)
  status                   Show running services and current profile
  profiles                 List available profiles
  env                      Extract environment variables from Phoenix container

🏷️  Profiles:
  --profile NAME               Single profile
  --profiles NAME1,NAME2       Multiple profiles (comma-separated)
  
  Available profiles:
  vite                         Enable Vite dev server (development mode)
  pkce-public                  PKCE Public Client + Grafana
  pkce-confidential            PKCE Confidential Client + Grafana
  basic-auth                   Basic authentication (username/password)
  in-memory                    In-memory SQLite database
  toxiproxy                    Enable network simulation with Toxiproxy
  grafana                      Enable Grafana and Prometheus monitoring
  mock-llm                     Enable the mock LLM server (dashboard via Traefik)
  datagen                      Replay synthetic traces (one project per application)
  ldap                         Enable LDAP authentication (mock LDAP server)
  ldap-no-email                Enable LDAP authentication (users without email)
  ldap-posix                   Enable LDAP with POSIX groups (no memberOf)
  schema=NAME                  Dynamic schema profile (custom database name)

💡 Which command to use?
  Something broken?       → doctor
  Changed code?           → up
  Dependencies changed?   → rebuild
  Need fresh images?      → reset
  Need fresh data?        → destroy
  Low on disk space?      → prune (or clean for full cleanup)
  Test PKCE?              → up --profile pkce-public

🌐 Access:
  Phoenix:       http://localhost:18273/phoenix/
  Mail:          http://localhost:18273/mail/
  Database:      localhost:5433 (postgres/postgres)

Examples:
  ./dev.sh up                              # Standard mode (production - no Vite)
  ./dev.sh up --profile vite               # Enable Vite dev server
  ./dev.sh up --profiles vite,grafana      # Multiple profiles
  ./dev.sh up --profile pkce-public        # Test PKCE public client
  ./dev.sh up --profile grafana            # Enable monitoring
  ./dev.sh up --profile mock-llm           # Enable the mock LLM server
  ./dev.sh up --profile datagen            # Replay synthetic traces
  ./dev.sh up --profile ldap               # Test LDAP authentication
  ./dev.sh up --profile ldap-no-email      # LDAP without email addresses
  ./dev.sh up --profile ldap-posix         # LDAP with POSIX groups
  ./dev.sh status                          # Check what's running
  ./dev.sh prune                           # Free up disk space
  ./dev.sh env | grep DATABASE             # Check database config
EOF
        ;;
esac

