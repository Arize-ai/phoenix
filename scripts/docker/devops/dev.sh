#!/bin/bash

# Phoenix Development Environment with Native Docker Compose Profiles
# Usage: ./dev.sh [command] [options]

set -e

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEV_DIR"

# Global variables
CURRENT_PROFILES=""
CURRENT_SCHEMA=""
COMPOSE_FILES="-f docker-compose.yml"
PROFILE_FLAGS=""
COMMAND=""

# Logging helpers
log_info() { echo "🔵 $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }

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
                local profile="$2"
                
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
                shift 2
                ;;
            --profiles)
                if [[ -z "$2" ]] || [[ "$2" =~ ^-- ]]; then
                    log_error "Profile list required after --profiles"
                    exit 1
                fi
                local profiles_list="$2"
                
                # Split comma-separated profiles
                IFS=',' read -ra PROFILE_ARRAY <<< "$profiles_list"
                for profile in "${PROFILE_ARRAY[@]}"; do
                    # Trim whitespace
                    profile=$(echo "$profile" | xargs)
                    
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

# Build docker-compose command
compose_cmd() {
    echo "docker-compose $COMPOSE_FILES $PROFILE_FLAGS"
}

# Wait for Phoenix health check
wait_for_phoenix() {
    echo "⏳ Waiting for Phoenix to be ready..."
    local max_attempts=60
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:18273/phoenix/healthz > /dev/null 2>&1; then
            echo ""
            log_success "Phoenix is ready!"
            return 0
        fi
        
        if [ $attempt -eq 1 ]; then
            echo -n "   Checking health"
        fi
        echo -n "."

        if [ $attempt -eq 15 ]; then
            echo ""
            echo "💡 Phoenix is taking longer than expected. Recent logs:"
            echo "────────────────────────────────────────────────────────"
            local logs=$($(compose_cmd) logs phoenix --tail=100)
            echo "$logs"
            echo "────────────────────────────────────────────────────────"
            
            if echo "$logs" | grep -qi -E "(exception|error|failed|traceback|phoenix\.exceptions)"; then
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
    log_error "Phoenix health check failed after 1 minute"
    echo "   Check logs: $(compose_cmd) logs phoenix"
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
                "grafana")
                    echo "  Monitoring: Grafana + Prometheus enabled"
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
    
    if $(compose_cmd) ps --format table 2>/dev/null | grep -q "Up"; then
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
    echo "  ./dev.sh up --profile schema=myapp       # Custom schema 'myapp'"
    echo "  ./dev.sh up --profiles vite,grafana      # Multiple profiles"
}

# Parse arguments first
parse_args "$@"

# Main commands
case "${COMMAND:-help}" in
    "up")
        if [[ -n "$CURRENT_PROFILES" ]]; then
            log_info "Starting Phoenix development environment with profiles: $CURRENT_PROFILES"
        else
            log_info "Starting Phoenix development environment (standard mode)"
        fi
        
        echo "📦 Starting all services..."
        $(compose_cmd) up -d --build
        
        if wait_for_phoenix; then
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
        
        DOCKER_BUILDKIT=1 $(compose_cmd) build --no-cache
        echo "📦 Starting all services..."
        $(compose_cmd) up -d --force-recreate
        
        if wait_for_phoenix; then
            log_success "Environment ready!"
            show_services
        else
            log_error "Failed to start Phoenix environment"
            exit 1
        fi
        ;;
    
    "down")
        log_info "Stopping environment..."
        $(compose_cmd) down
        ;;

    "destroy")
        log_warning "Destroying all data (postgres, grafana, prometheus)..."
        log_warning "This will permanently delete all database data!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Stopping all services..."
            $(compose_cmd) down
            log_info "Removing data volumes..."
            docker volume rm devops_dev_database_data devops_dev_grafana_data devops_dev_prometheus_data 2>/dev/null || true
            log_success "All data destroyed! Run './dev.sh up' to start fresh."
        else
            log_error "Operation cancelled."
        fi
        ;;

    "reset")
        log_info "Resetting all images (will rebuild on next 'up' command)..."
        log_info "Stopping all services..."
        $(compose_cmd) down
        log_info "Removing all images..."
        docker rmi devops-phoenix devops-oidc-dev devops-smtp-dev devops-vite-dev 2>/dev/null || true
        log_success "All images removed! Run './dev.sh up' to rebuild and start."
        ;;

    "status")
        show_status
        ;;

    "profiles")
        list_profiles
        ;;

    "env")
        # Check if Phoenix container is running
        if ! $(compose_cmd) ps phoenix | grep -q "Up"; then
            log_error "Phoenix container is not running" >&2
            echo "Use './dev.sh up' to start the Phoenix container first" >&2
            exit 1
        fi
        
        # Get container name
        container_name=$($(compose_cmd) ps -q phoenix)
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
  up [--profile NAME]      Start services (DEFAULT - use for code changes)
  rebuild [--profile NAME] Full rebuild (slowest - when dependencies change)
  down                     Stop all services  
  reset                    Remove all images (rebuild on next 'up')
  destroy                  Wipe data volumes (database, grafana, prometheus)
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
  schema=NAME                  Dynamic schema profile (custom database name)

💡 Which command to use?
  Changed code?           → up
  Dependencies changed?   → rebuild
  Need fresh images?      → reset
  Need fresh data?        → destroy
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
  ./dev.sh status                          # Check what's running
  ./dev.sh env | grep DATABASE             # Check database config
EOF
        ;;
esac

