#!/bin/bash

# Phoenix Kubernetes Development Environment (Apple container cluster / kind)
# Usage: ./dev.sh [command] [options]

set -euo pipefail

K8S_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(cd "$K8S_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEV_DIR/../.." && pwd)"
HELM_CHART_DIR="$REPO_ROOT/helm"
STATE_DIR="$DEV_DIR/.state"
mkdir -p "$STATE_DIR"

readonly CLUSTER_NAME="${DEVOPS_CLUSTER_NAME:-phoenix-devops-local}"
readonly NAMESPACE="phoenix-devops"
readonly GATEWAY_NAME="${CLUSTER_NAME}-gateway"
readonly HTTP_PORT="${DEVOPS_HTTP_PORT:-18273}"
readonly PG_PORT="${DEVOPS_PG_PORT:-5433}"
readonly LDAP_ADMIN_PORT="${DEVOPS_LDAP_ADMIN_PORT:-6443}"
readonly KUBECONFIG_PATH="$STATE_DIR/kubeconfig"
readonly ACTIVE_PROFILES_FILE="$STATE_DIR/active-profiles"
readonly VITE_SYNC_PID_FILE="$STATE_DIR/vite-sync.pid"
readonly VITE_SYNC_LOG_FILE="$STATE_DIR/vite-sync.log"
readonly HEALTH_URL="http://localhost:${HTTP_PORT}/phoenix/healthz"
readonly HEALTH_TIMEOUT=120
readonly HEALTH_LOG_CHECK=25
readonly DATAGEN_STATE_URL="http://localhost:${HTTP_PORT}/datagen/api/state"
readonly DATAGEN_TIMEOUT=150

# Cluster & builder sizing for Apple container VMs (override via env vars if desired)
readonly CLUSTER_CPUS="${DEVOPS_CLUSTER_CPUS:-6}"
readonly CLUSTER_MEMORY="${DEVOPS_CLUSTER_MEMORY:-12g}"
readonly BUILDER_CPUS="${DEVOPS_BUILDER_CPUS:-6}"
readonly BUILDER_MEMORY="${DEVOPS_BUILDER_MEMORY:-8g}"

CURRENT_PROFILES=""
CURRENT_SCHEMA=""
PROFILES_EXPLICIT=0
COMMAND=""
ASSUME_YES=false
BUILD_ON_UP=false
SEED_SCALE="${SEED_SCALE:-1}"
BACKEND="${DEVOPS_K8S_BACKEND:-auto}" # auto | apple-container | kind
if [[ "$BACKEND" == "auto" ]]; then
    case "${PHOENIX_DEV_ENGINE:-}" in
        container|apple-container) BACKEND="apple-container" ;;
        kind) BACKEND="kind" ;;
    esac
fi
KUBE_CTX=""

log_info() { echo "🔵 $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }

has_profile() {
    [[ " $CURRENT_PROFILES " == *" $1 "* ]]
}

# Detect local cluster backend (Apple container preferred on macOS 26+, kind fallback)
detect_backend() {
    if [[ "$BACKEND" == "apple-container" || "$BACKEND" == "container" ]]; then
        BACKEND="apple-container"
        KUBE_CTX="$CLUSTER_NAME"
        return 0
    elif [[ "$BACKEND" == "kind" ]]; then
        KUBE_CTX="kind-$CLUSTER_NAME"
        return 0
    elif [[ "$BACKEND" == "auto" ]]; then
        if command -v container >/dev/null 2>&1; then
            BACKEND="apple-container"
            KUBE_CTX="$CLUSTER_NAME"
            return 0
        elif command -v kind >/dev/null 2>&1; then
            BACKEND="kind"
            KUBE_CTX="kind-$CLUSTER_NAME"
            return 0
        fi
    fi
    BACKEND="missing"
    KUBE_CTX=""
}

check_dependencies() {
    detect_backend
    local missing=()
    command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
    command -v helm >/dev/null 2>&1 || missing+=("helm")
    command -v jq >/dev/null 2>&1 || missing+=("jq")
    command -v curl >/dev/null 2>&1 || missing+=("curl")
    command -v python3 >/dev/null 2>&1 || missing+=("python3")

    if [[ "$BACKEND" == "missing" ]]; then
        missing+=("container (brew install container) OR kind (brew install kind)")
    elif [[ "$BACKEND" == "kind" ]]; then
        command -v docker >/dev/null 2>&1 || missing+=("docker")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing[*]}"
        echo "Run './dev.sh doctor' for a full environment check"
        exit 1
    fi
}

# Safety guard: ensure kubeconfig points strictly at a local VM/loopback IP (never GKE/EKS/AKS)
verify_safe_local_cluster() {
    if [[ ! -f "$KUBECONFIG_PATH" ]]; then
        log_error "Local kubeconfig not found at $KUBECONFIG_PATH"
        return 1
    fi
    local server
    server=$(kubectl --kubeconfig "$KUBECONFIG_PATH" --context "$KUBE_CTX" config view --minify -o jsonpath='{.clusters[0].cluster.server}' 2>/dev/null || true)
    if [[ -z "$server" ]]; then
        log_error "Context '$KUBE_CTX' missing in $KUBECONFIG_PATH"
        return 1
    fi
    if [[ ! "$server" =~ ^https://(127\.0\.0\.1|localhost|192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]+\.[0-9]+)(:[0-9]+)?$ ]]; then
        log_error "Refusing to operate on non-local Kubernetes API server: $server"
        exit 1
    fi
}

kctl() {
    verify_safe_local_cluster
    kubectl --kubeconfig "$KUBECONFIG_PATH" --context "$KUBE_CTX" "$@"
}

hlm() {
    verify_safe_local_cluster
    helm --kubeconfig "$KUBECONFIG_PATH" --kube-context "$KUBE_CTX" "$@"
}

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

validate_profile() {
    case "$1" in
        vite|pkce-public|pkce-confidential|basic-auth|in-memory|toxiproxy|grafana|lgtm|mock-llm|datagen|ldap|ldap-no-email|ldap-posix|ldap-test)
            return 0
            ;;
        schema=*)
            validate_schema_name "${1#schema=}"
            return $?
            ;;
        *)
            log_error "Unknown profile: $1"
            exit 1
            ;;
    esac
}

add_profile() {
    local profile="$1"
    validate_profile "$profile"
    if [[ "$profile" =~ ^schema= ]]; then
        CURRENT_SCHEMA="${profile#schema=}"
        log_info "Using dynamic schema profile with schema: $CURRENT_SCHEMA"
    fi
    if ! has_profile "$profile"; then
        CURRENT_PROFILES="${CURRENT_PROFILES:+$CURRENT_PROFILES }$profile"
    fi
    # pkce-public / pkce-confidential overrides configure Grafana OAuth as well; keep parity when grafana is enabled
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --profile)
                if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" =~ ^-- ]]; then
                    log_error "Profile name required after --profile"
                    exit 1
                fi
                PROFILES_EXPLICIT=1
                add_profile "$2"
                shift 2
                ;;
            --profiles)
                if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" =~ ^-- ]]; then
                    log_error "Profile list required after --profiles"
                    exit 1
                fi
                PROFILES_EXPLICIT=1
                IFS=',' read -ra PROFILE_ARRAY <<< "$2"
                for p in "${PROFILE_ARRAY[@]}"; do
                    p="$(echo "$p" | xargs)"
                    [[ -n "$p" ]] && add_profile "$p"
                done
                shift 2
                ;;
            --backend)
                if [[ $# -lt 2 || -z "${2:-}" ]]; then
                    log_error "Backend name required after --backend (apple-container or kind)"
                    exit 1
                fi
                BACKEND="$2"
                shift 2
                ;;
            -y|--yes)
                ASSUME_YES=true
                shift
                ;;
            -b|--build)
                BUILD_ON_UP=true
                shift
                ;;
            --scale)
                if [[ $# -lt 2 || -z "${2:-}" || ! "${2:-}" =~ ^[0-9]+$ ]]; then
                    log_error "A whole number is required after --scale"
                    exit 1
                fi
                SEED_SCALE="$2"
                shift 2
                ;;
            *)
                if [[ -z "$COMMAND" ]]; then
                    COMMAND="$1"
                fi
                shift
                ;;
        esac
    done
}

# Ensure Apple container system service + recommended kernel are ready
ensure_apple_container_system() {
    if ! container system status >/dev/null 2>&1; then
        log_info "Starting Apple container system service..."
        container system start --disable-kernel-install >/dev/null 2>&1 || container system start
    fi
    # The container CLI has no command to list kernels, so check for the default kernel file.
    # Starting the service with --disable-kernel-install leaves an empty kernels directory.
    if ! apple_container_kernel_configured; then
        log_info "Installing recommended Linux kernel for Apple container..."
        container system kernel set --recommended
    fi
}

apple_container_kernel_configured() {
    [[ -e "$HOME/Library/Application Support/com.apple.container/kernels/default.kernel-$(uname -m)" ]]
}

# The API server is published on 127.0.0.1 by container-runtime-linux. macOS Local Network
# privacy can block that helper from reaching the node VM, which shows up as connection resets.
wait_for_apple_container_api() {
    local attempt
    for attempt in {1..15}; do
        if kctl get --raw /readyz >/dev/null 2>&1; then
            return 0
        fi
        sleep 2
    done
    log_error "Cannot reach the Kubernetes API server through its localhost port forward"
    echo "   If 'container system logs' shows 'No route to host', allow 'container' under"
    echo "   System Settings > Privacy & Security > Local Network, then run './dev.sh up' again."
    exit 1
}

cluster_exists() {
    if [[ "$BACKEND" == "apple-container" ]]; then
        ensure_apple_container_system
        local state
        state=$(container cluster ls --format json 2>/dev/null | jq -r --arg name "$CLUSTER_NAME" '[.[] | select(.id == $name) | .status.state][0] // empty')
        [[ "$state" == "running" ]]
    else
        kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"
    fi
}

ensure_cluster() {
    if [[ "$BACKEND" == "apple-container" ]]; then
        ensure_apple_container_system
        local state
        state=$(container cluster ls --format json 2>/dev/null | jq -r --arg name "$CLUSTER_NAME" '[.[] | select(.id == $name) | .status.state][0] // empty')
        if [[ -n "$state" && "$state" != "running" ]]; then
            log_warning "Cluster '$CLUSTER_NAME' is in state '$state'; recreating..."
            container cluster delete --name "$CLUSTER_NAME" >/dev/null 2>&1 || true
            state=""
        fi
        if [[ -z "$state" ]]; then
            log_info "Creating Apple container Kubernetes cluster '$CLUSTER_NAME' (${CLUSTER_CPUS} CPUs, ${CLUSTER_MEMORY} RAM)..."
            local prev_ctx=""
            prev_ctx=$(kubectl config current-context 2>/dev/null || true)
            KUBECONFIG="$KUBECONFIG_PATH" container cluster create \
                --name "$CLUSTER_NAME" \
                --cpus "$CLUSTER_CPUS" \
                --memory "$CLUSTER_MEMORY"
            local after_ctx=""
            after_ctx=$(kubectl config current-context 2>/dev/null || true)
            if [[ -n "$prev_ctx" && "$prev_ctx" != "$after_ctx" ]]; then
                kubectl config use-context "$prev_ctx" >/dev/null 2>&1 || true
            fi
        elif [[ ! -f "$KUBECONFIG_PATH" ]]; then
            container cluster write-config --name "$CLUSTER_NAME" --kubeconfig "$KUBECONFIG_PATH"
        fi

        wait_for_apple_container_api

        # kindest/node ships local-path-provisioner in /kind/manifests/default-storage.yaml,
        # which `container cluster create` does not apply automatically. Install it idempotently
        # so ReadWriteOnce PVCs (Postgres, Grafana, Prometheus, Datagen) bind cleanly.
        if ! kctl get storageclass standard >/dev/null 2>&1; then
            log_info "Installing local-path-provisioner default StorageClass..."
            container exec "$CLUSTER_NAME" cat /kind/manifests/default-storage.yaml | kctl apply -f - >/dev/null
            kctl wait --for=condition=ready pod -n local-path-storage --all --timeout=60s >/dev/null
        fi
    else
        if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
            log_info "Creating kind Kubernetes cluster '$CLUSTER_NAME'..."
            local kind_cfg="$STATE_DIR/kind-config.yaml"
            cat > "$kind_cfg" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: ${HTTP_PORT}
        listenAddress: "127.0.0.1"
        protocol: TCP
      - containerPort: 30433
        hostPort: ${PG_PORT}
        listenAddress: "127.0.0.1"
        protocol: TCP
      - containerPort: 30643
        hostPort: ${LDAP_ADMIN_PORT}
        listenAddress: "127.0.0.1"
        protocol: TCP
EOF
            KUBECONFIG="$KUBECONFIG_PATH" kind create cluster --name "$CLUSTER_NAME" --config "$kind_cfg"
        else
            kind get kubeconfig --name "$CLUSTER_NAME" > "$KUBECONFIG_PATH"
        fi
    fi
}

# Start/update the host-port TCP gateway container on Apple container's vmnet
# Forwards 127.0.0.1:18273 -> node:30080 (Traefik), 127.0.0.1:5433 -> node:30433 (Postgres),
# and (when LDAP is active) 127.0.0.1:6443 -> node:30643 (phpLDAPadmin).
ensure_gateway() {
    if [[ "$BACKEND" != "apple-container" ]]; then
        return 0
    fi

    local node_ip node_net
    node_ip=$(kctl get node "$CLUSTER_NAME" -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}')
    node_net=$(container inspect "$CLUSTER_NAME" | jq -r --arg ip "$node_ip" '[.[0].status.networks[]? | select(.ipv4Address | startswith($ip + "/")) | .network][0] // "default"')

    local gw_dir="$STATE_DIR/gateway"
    mkdir -p "$gw_dir"
    local new_conf="$gw_dir/nginx.conf.new"
    cat > "$new_conf" <<EOF
worker_processes auto;
events {
    worker_connections 1024;
}
stream {
    server {
        listen 18273;
        proxy_connect_timeout 5s;
        proxy_timeout 3600s;
        proxy_pass ${node_ip}:30080;
    }
    server {
        listen 5433;
        proxy_connect_timeout 5s;
        proxy_timeout 3600s;
        proxy_pass ${node_ip}:30433;
    }
    server {
        listen 6443;
        proxy_connect_timeout 5s;
        proxy_timeout 3600s;
        proxy_pass ${node_ip}:30643;
    }
}
EOF

    local running_state
    running_state=$(container inspect "$GATEWAY_NAME" 2>/dev/null | jq -r '.[0].status // empty' || true)
    local needs_recreate=0
    if [[ ! -f "$gw_dir/nginx.conf" ]] || ! cmp -s "$new_conf" "$gw_dir/nginx.conf"; then
        mv "$new_conf" "$gw_dir/nginx.conf"
        needs_recreate=1
    else
        rm -f "$new_conf"
    fi
    if [[ "$running_state" != "running" ]]; then
        needs_recreate=1
    fi

    if [[ "$needs_recreate" -eq 1 ]]; then
        log_info "Starting localhost gateway ($GATEWAY_NAME -> ${node_ip})..."
        container stop "$GATEWAY_NAME" >/dev/null 2>&1 || true
        container delete "$GATEWAY_NAME" >/dev/null 2>&1 || true
        container run -d --name "$GATEWAY_NAME" \
            --network "$node_net" \
            -p "127.0.0.1:${HTTP_PORT}:18273" \
            -p "127.0.0.1:${PG_PORT}:5433" \
            -p "127.0.0.1:${LDAP_ADMIN_PORT}:6443" \
            --mount "type=bind,source=${gw_dir},target=/etc/nginx-gw,readonly" \
            nginx:1.27-alpine \
            nginx -c /etc/nginx-gw/nginx.conf -g "daemon off;" >/dev/null
    fi
}

stop_gateway() {
    if command -v container >/dev/null 2>&1; then
        container stop "$GATEWAY_NAME" >/dev/null 2>&1 || true
        container delete "$GATEWAY_NAME" >/dev/null 2>&1 || true
    fi
}

stop_vite_sync() {
    if [[ -f "$VITE_SYNC_PID_FILE" ]]; then
        local pid
        pid=$(cat "$VITE_SYNC_PID_FILE" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
        rm -f "$VITE_SYNC_PID_FILE"
    fi
}

start_vite_sync() {
    stop_vite_sync
    if ! has_profile "vite"; then
        return 0
    fi
    log_info "Starting Vite file-sync daemon (js/app -> vite-dev pod)..."
    python3 -c '
import subprocess, sys
with open(sys.argv[1], "ab") as log:
    p = subprocess.Popen(sys.argv[2:], stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
    print(p.pid)
' "$VITE_SYNC_LOG_FILE" python3 "$DEV_DIR/scripts/sync-vite.py" \
        --kubeconfig "$KUBECONFIG_PATH" \
        --context "$KUBE_CTX" \
        --namespace "$NAMESPACE" \
        --source "$REPO_ROOT/js/app" > "$VITE_SYNC_PID_FILE"
}

# Compute deterministic fingerprint over build context + Dockerfile to skip redundant builds/imports
compute_context_hash() {
    local context_dir="$1"
    local dockerfile="$2"
    python3 - "$REPO_ROOT" "$context_dir" "$dockerfile" <<'PY'
import hashlib, os, subprocess, sys

repo_root, context_dir, dockerfile = sys.argv[1], sys.argv[2], sys.argv[3]
h = hashlib.sha256()

def feed_file(path, label):
    try:
        st = os.stat(path)
    except OSError:
        return
    h.update(f"{label}:{st.st_size}:{st.st_mtime_ns}\n".encode())

feed_file(dockerfile, os.path.relpath(dockerfile, repo_root))

rel_ctx = os.path.relpath(context_dir, repo_root)
if rel_ctx == ".":
    # Root Phoenix build context: hash src/, js/ (excluding node_modules), schemas/, scripts/devops/, pyproject.toml, uv.lock
    paths = ["pyproject.toml", "uv.lock", "src", "schemas", "scripts/devops/scripts", "scripts/devops/vscode-config"]
    if not dockerfile.endswith("Dockerfile.vite"):
        paths.append("js")
    cmd = ["git", "-C", repo_root, "ls-files", "-co", "--exclude-standard", "--", *paths]
else:
    cmd = ["git", "-C", repo_root, "ls-files", "-co", "--exclude-standard", "--", rel_ctx]

out = subprocess.check_output(cmd, text=True)
for rel in sorted(out.splitlines()):
    if "/node_modules/" in rel or rel.endswith("/node_modules"):
        continue
    feed_file(os.path.join(repo_root, rel), rel)

print(h.hexdigest())
PY
}

node_has_image() {
    local image_ref="$1"
    if [[ "$BACKEND" == "apple-container" ]]; then
        container exec "$CLUSTER_NAME" ctr --namespace k8s.io images ls -q 2>/dev/null | grep -qx "$image_ref"
    else
        docker exec "${CLUSTER_NAME}-control-plane" ctr --namespace k8s.io images ls -q 2>/dev/null | grep -qx "$image_ref"
    fi
}

# Apple container's default BuildKit VM allocates only 2 CPUs and 2 GiB RAM, which
# thrushes/OOMs on Vite's 8,400-module Phoenix UI bundle. Ensure >= 8 GiB RAM.
ensure_apple_builder() {
    local status mem_mb
    status=$(container builder status 2>/dev/null | awk 'NR==2 {print $3}' || true)
    mem_mb=$(container builder status 2>/dev/null | awk 'NR==2 {print $(NF-1)}' || true)
    if [[ "$status" == "running" ]]; then
        if [[ -n "$mem_mb" && "$mem_mb" =~ ^[0-9]+$ && "$mem_mb" -lt 4096 ]]; then
            log_info "Resizing Apple container builder VM (${mem_mb} MB -> ${BUILDER_MEMORY})..."
            container builder delete --force >/dev/null 2>&1 || true
            status=""
        fi
    fi
    if [[ "$status" != "running" ]]; then
        log_info "Starting Apple container builder (${BUILDER_CPUS} CPUs, ${BUILDER_MEMORY} RAM)..."
        container builder delete --force >/dev/null 2>&1 || true
        container builder start --cpus "$BUILDER_CPUS" --memory "$BUILDER_MEMORY" >/dev/null
    fi
}

# Stage a clean, minimal build context for repo-root Phoenix builds so BuildKit
# transfers ~50 MB in <2s instead of scanning untracked root directories for 3+ minutes.
prepare_phoenix_context() {
    local include_js="$1"
    local stage_dir="$STATE_DIR/phoenix-context"
    rm -rf "$stage_dir"
    mkdir -p "$stage_dir"

    python3 - "$REPO_ROOT" "$stage_dir" "$include_js" <<'PY'
import os, shutil, subprocess, sys

repo_root, stage_dir, include_js = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
paths = [
    "pyproject.toml",
    "uv.lock",
    "LICENSE",
    "IP_NOTICE",
    "README.md",
    "src",
    "schemas",
    "scripts/devops/scripts",
    "scripts/devops/vscode-config",
]
if include_js:
    paths.append("js")

out = subprocess.check_output(
    ["git", "-C", repo_root, "ls-files", "-co", "--exclude-standard", "-z", "--", *paths]
)
for raw in out.split(b"\0"):
    if not raw:
        continue
    rel = raw.decode("utf-8", "surrogateescape")
    if "/node_modules/" in rel or rel.endswith("/node_modules"):
        continue
    src = os.path.join(repo_root, rel)
    dst = os.path.join(stage_dir, rel)
    if not os.path.lexists(src):
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.islink(src):
        os.symlink(os.readlink(src), dst)
    elif os.path.isfile(src):
        try:
            os.link(src, dst)
        except OSError:
            shutil.copy2(src, dst)
PY
    echo "$stage_dir"
}

build_and_load_image() {
    local name="$1"
    local image_ref="$2"
    local context_dir="$3"
    local dockerfile="$4"
    local force_no_cache="${5:-0}"

    local hash_dir="$STATE_DIR/image-hashes"
    mkdir -p "$hash_dir"
    local hash_file="$hash_dir/${name}.sha256"
    local current_hash
    current_hash=$(compute_context_hash "$context_dir" "$dockerfile")

    if [[ "$force_no_cache" -eq 0 && "$BUILD_ON_UP" != "true" && -f "$hash_file" ]] && [[ "$(cat "$hash_file")" == "$current_hash" ]] && node_has_image "$image_ref"; then
        echo "   ✓ $name ($image_ref) is up to date"
        return 0
    fi

    local effective_context="$context_dir"
    local staged_cleanup=""
    if [[ "$context_dir" == "$REPO_ROOT" ]]; then
        local include_js="1"
        [[ "$dockerfile" == *"Dockerfile.vite" ]] && include_js="0"
        effective_context=$(prepare_phoenix_context "$include_js")
        staged_cleanup="$effective_context"
    fi

    log_info "Building $name ($image_ref)..."
    local extra_args=()
    [[ "$force_no_cache" -eq 1 ]] && extra_args+=("--no-cache")

    if [[ "$BACKEND" == "apple-container" ]]; then
        ensure_apple_builder
        container build --cpus "$BUILDER_CPUS" --memory "$BUILDER_MEMORY" ${extra_args[@]+"${extra_args[@]}"} --tag "$image_ref" --file "$dockerfile" "$effective_context"
        [[ -n "$staged_cleanup" ]] && rm -rf "$staged_cleanup"
        log_info "Loading $image_ref into cluster '$CLUSTER_NAME'..."
        local tar_path="$STATE_DIR/${name}.oci.tar"
        rm -f "$tar_path"
        container image save --output "$tar_path" "$image_ref"
        container exec -i "$CLUSTER_NAME" ctr --namespace k8s.io images import - < "$tar_path" >/dev/null
        rm -f "$tar_path"
        container image prune >/dev/null 2>&1 || true
    else
        DOCKER_BUILDKIT=1 docker build ${extra_args[@]+"${extra_args[@]}"} --tag "$image_ref" --file "$dockerfile" "$effective_context"
        [[ -n "$staged_cleanup" ]] && rm -rf "$staged_cleanup"
        log_info "Loading $image_ref into kind cluster '$CLUSTER_NAME'..."
        kind load docker-image "$image_ref" --name "$CLUSTER_NAME"
    fi

    echo "$current_hash" > "$hash_file"
    REBUILT_LAST=1
    return 0
}

build_required_images() {
    local force_no_cache="${1:-0}"
    REBUILT_SERVICES=()

    REBUILT_LAST=0
    build_and_load_image "oidc-dev" "docker.io/library/devops-oidc-dev:local" \
        "$DEV_DIR/oidc-server" "$DEV_DIR/oidc-server/Dockerfile" "$force_no_cache"
    if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/oidc-dev"); fi

    REBUILT_LAST=0
    build_and_load_image "smtp-dev" "docker.io/library/devops-smtp-dev:local" \
        "$DEV_DIR/smtp-server" "$DEV_DIR/smtp-server/Dockerfile" "$force_no_cache"
    if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/smtp-dev"); fi

    if has_profile "vite"; then
        REBUILT_LAST=0
        build_and_load_image "phoenix-vite" "docker.io/library/devops-phoenix-vite:local" \
            "$REPO_ROOT" "$DEV_DIR/Dockerfile.vite" "$force_no_cache"
        if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/phoenix"); fi

        REBUILT_LAST=0
        build_and_load_image "vite-dev" "docker.io/library/devops-vite-dev:local" \
            "$REPO_ROOT" "$DEV_DIR/vite-dev/Dockerfile" "$force_no_cache"
        if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/vite-dev"); fi

        # Datagen still uses devops-phoenix:local if combined with vite
        if has_profile "datagen"; then
            REBUILT_LAST=0
            build_and_load_image "phoenix" "docker.io/library/devops-phoenix:local" \
                "$REPO_ROOT" "$DEV_DIR/Dockerfile" "$force_no_cache"
            if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/datagen"); fi
        fi
    else
        REBUILT_LAST=0
        build_and_load_image "phoenix" "docker.io/library/devops-phoenix:local" \
            "$REPO_ROOT" "$DEV_DIR/Dockerfile" "$force_no_cache"
        if [[ "$REBUILT_LAST" -eq 1 ]]; then
            REBUILT_SERVICES+=("deployment/phoenix")
            if has_profile "datagen"; then REBUILT_SERVICES+=("deployment/datagen"); fi
        fi
    fi

    if has_profile "mock-llm"; then
        REBUILT_LAST=0
        build_and_load_image "mock-llm" "docker.io/library/devops-mock-llm:local" \
            "$DEV_DIR/mock-llm-server" "$DEV_DIR/mock-llm-server/Dockerfile" "$force_no_cache"
        if [[ "$REBUILT_LAST" -eq 1 ]]; then REBUILT_SERVICES+=("deployment/mock-llm"); fi
    fi
    return 0
}

# Sync large/shared file ConfigMaps directly from scripts/devops using server-side apply
sync_shared_configmaps() {
    kctl create namespace "$NAMESPACE" --dry-run=client -o yaml | kctl apply --server-side -f - >/dev/null

    if has_profile "grafana"; then
        kctl -n "$NAMESPACE" create configmap grafana-dashboards \
            --from-file=phoenix-simple-monitoring.json="$DEV_DIR/grafana/dashboards/phoenix-simple-monitoring.json" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi

    if has_profile "lgtm"; then
        kctl -n "$NAMESPACE" create configmap lgtm-config \
            --from-file=otelcol-phoenix.yaml="$DEV_DIR/lgtm/otelcol-phoenix.yaml" \
            --from-file=phoenix.yaml="$DEV_DIR/lgtm/provisioning/dashboards/phoenix.yaml" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
        kctl -n "$NAMESPACE" create configmap lgtm-dashboards \
            --from-file=online-evaluations.json="$DEV_DIR/lgtm/dashboards/online-evaluations.json" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
        kctl -n "$NAMESPACE" create configmap lgtm-alerting \
            --from-file=online-evals-rules.yaml="$DEV_DIR/lgtm/provisioning/alerting/online-evals-rules.yaml" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi

    if has_profile "toxiproxy"; then
        kctl -n "$NAMESPACE" create configmap toxiproxy-ui-html \
            --from-file=index.html="$DEV_DIR/toxiproxy-ui/index.html" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi

    if has_profile "ldap" || has_profile "ldap-no-email" || has_profile "ldap-posix" || has_profile "ldap-test"; then
        kctl -n "$NAMESPACE" create configmap ldap-seeds \
            --from-file=ldap-seed.ldif="$DEV_DIR/ldap-seed.ldif" \
            --from-file=ldap-no-email-seed.ldif="$DEV_DIR/ldap-no-email-seed.ldif" \
            --from-file=ldap-posix-seed.ldif="$DEV_DIR/ldap-posix-seed.ldif" \
            --from-file=ldap-anonymous-acl.ldif="$DEV_DIR/ldap-anonymous-acl.ldif" \
            --from-file=ldap-grafana.toml="$DEV_DIR/ldap-grafana.toml" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi

    if has_profile "ldap-test"; then
        kctl -n "$NAMESPACE" create configmap ldap-test-scripts \
            --from-file=ldap_mitm_proxy.py="$DEV_DIR/scripts/ldap_mitm_proxy.py" \
            --from-file=test_ldap_integration.py="$DEV_DIR/scripts/test_ldap_integration.py" \
            --from-file=test_ldap_tls.py="$DEV_DIR/scripts/test_ldap_tls.py" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi
}

render_and_apply_manifests() {
    local render_dir="$STATE_DIR/render"
    rm -rf "$render_dir"
    mkdir -p "$render_dir"

    local components=()
    if has_profile "in-memory"; then components+=("../../k8s/manifests/components/in-memory"); fi
    if has_profile "ldap-test" && ! has_profile "in-memory"; then components+=("../../k8s/manifests/components/in-memory"); fi
    if has_profile "grafana"; then components+=("../../k8s/manifests/components/grafana"); fi
    if has_profile "lgtm"; then components+=("../../k8s/manifests/components/lgtm"); fi
    # pkce-* patches grafana too; auto-enable grafana if pkce-* is requested so Kustomize target exists
    if (has_profile "pkce-public" || has_profile "pkce-confidential") && ! has_profile "grafana"; then
        components+=("../../k8s/manifests/components/grafana")
    fi
    if has_profile "pkce-public"; then components+=("../../k8s/manifests/components/pkce-public"); fi
    if has_profile "pkce-confidential"; then components+=("../../k8s/manifests/components/pkce-confidential"); fi
    if has_profile "mock-llm"; then components+=("../../k8s/manifests/components/mock-llm"); fi
    if has_profile "datagen"; then components+=("../../k8s/manifests/components/datagen"); fi
    if has_profile "toxiproxy"; then components+=("../../k8s/manifests/components/toxiproxy"); fi
    if has_profile "vite"; then components+=("../../k8s/manifests/components/vite"); fi

    if has_profile "ldap-test"; then
        components+=("../../k8s/manifests/components/ldap-test")
    elif has_profile "ldap-no-email"; then
        components+=("../../k8s/manifests/components/ldap")
        components+=("../../k8s/manifests/components/ldap-no-email")
    elif has_profile "ldap-posix"; then
        components+=("../../k8s/manifests/components/ldap")
        components+=("../../k8s/manifests/components/ldap-posix")
    elif has_profile "ldap"; then
        components+=("../../k8s/manifests/components/ldap")
    fi

    {
        echo "apiVersion: kustomize.config.k8s.io/v1beta1"
        echo "kind: Kustomization"
        echo "namespace: $NAMESPACE"
        echo "resources:"
        echo "  - ../../k8s/manifests/base"
        if [[ ${#components[@]} -gt 0 ]]; then
            echo "components:"
            for c in "${components[@]}"; do
                echo "  - $c"
            done
        fi
    } > "$render_dir/kustomization.yaml"

    # Remove stale Jobs before re-applying (Job pod templates are immutable)
    kctl -n "$NAMESPACE" delete job toxiproxy-init ldap-seed ldap-no-email-seed ldap-anonymous-seed ldap-posix-seed --ignore-not-found >/dev/null 2>&1 || true

    # Prune optional profile workloads that are no longer active
    has_profile "mock-llm" || kctl -n "$NAMESPACE" delete deployment,service mock-llm --ignore-not-found >/dev/null 2>&1 || true
    has_profile "datagen" || kctl -n "$NAMESPACE" delete deployment,service datagen --ignore-not-found >/dev/null 2>&1 || true
    has_profile "toxiproxy" || kctl -n "$NAMESPACE" delete deployment,service toxiproxy toxiproxy-ui --ignore-not-found >/dev/null 2>&1 || true
    has_profile "vite" || kctl -n "$NAMESPACE" delete deployment,service vite-dev --ignore-not-found >/dev/null 2>&1 || true
    has_profile "lgtm" || kctl -n "$NAMESPACE" delete deployment,service lgtm grafana-mcp --ignore-not-found >/dev/null 2>&1 || true
    if ! has_profile "grafana" && ! has_profile "pkce-public" && ! has_profile "pkce-confidential"; then
        kctl -n "$NAMESPACE" delete deployment,service prometheus grafana postgres-exporter tempo loki otel-collector --ignore-not-found >/dev/null 2>&1 || true
    fi
    if ! has_profile "ldap" && ! has_profile "ldap-no-email" && ! has_profile "ldap-posix" && ! has_profile "ldap-test"; then
        kctl -n "$NAMESPACE" delete deployment,service ldap ldap-admin --ignore-not-found >/dev/null 2>&1 || true
    fi
    if ! has_profile "ldap-test"; then
        kctl -n "$NAMESPACE" delete deployment,service ldap-no-email ldap-anonymous ldap-posix ldap-mitm-proxy ldap-anonymous-mitm-proxy phoenix-starttls phoenix-anonymous-ldaps phoenix-anonymous-starttls phoenix-posix grafana-ldap ldap-test --ignore-not-found >/dev/null 2>&1 || true
    fi

    # Ensure Grafana dashboard ConfigMap exists whenever grafana component is rendered (e.g., via pkce-*)
    if (has_profile "pkce-public" || has_profile "pkce-confidential") && ! has_profile "grafana"; then
        kctl -n "$NAMESPACE" create configmap grafana-dashboards \
            --from-file=phoenix-simple-monitoring.json="$DEV_DIR/grafana/dashboards/phoenix-simple-monitoring.json" \
            --dry-run=client -o yaml | kctl apply --server-side --force-conflicts -f - >/dev/null
    fi

    log_info "Applying companion Kubernetes manifests..."
    local prev_traefik_hash new_traefik_hash
    prev_traefik_hash=$(kctl -n "$NAMESPACE" get configmap traefik-dynamic-profiles -o json 2>/dev/null | jq -cS '.data' | shasum -a 256 | awk '{print $1}' || true)
    kubectl kustomize "$render_dir" | kctl apply --server-side --force-conflicts -f - >/dev/null
    new_traefik_hash=$(kctl -n "$NAMESPACE" get configmap traefik-dynamic-profiles -o json 2>/dev/null | jq -cS '.data' | shasum -a 256 | awk '{print $1}' || true)
    if [[ -n "$prev_traefik_hash" && "$prev_traefik_hash" != "$new_traefik_hash" ]]; then
        kctl -n "$NAMESPACE" rollout restart deployment/traefik >/dev/null
    fi

    # Wait for database + Toxiproxy init before Phoenix starts
    if ! has_profile "in-memory" && ! has_profile "ldap-test"; then
        log_info "Waiting for PostgreSQL to be ready..."
        kctl -n "$NAMESPACE" rollout status statefulset/db --timeout=90s >/dev/null
    fi
    kctl -n "$NAMESPACE" rollout status deployment/traefik --timeout=60s >/dev/null
    kctl -n "$NAMESPACE" rollout status deployment/smtp-dev --timeout=60s >/dev/null
    kctl -n "$NAMESPACE" rollout status deployment/oidc-dev --timeout=60s >/dev/null

    if has_profile "toxiproxy"; then
        log_info "Waiting for Toxiproxy initialization job..."
        kctl -n "$NAMESPACE" rollout status deployment/toxiproxy --timeout=60s >/dev/null
        kctl -n "$NAMESPACE" wait --for=condition=complete job/toxiproxy-init --timeout=60s >/dev/null
    fi

    if has_profile "ldap" || has_profile "ldap-no-email" || has_profile "ldap-posix"; then
        log_info "Waiting for LDAP seed job..."
        kctl -n "$NAMESPACE" rollout status deployment/ldap --timeout=90s >/dev/null
        kctl -n "$NAMESPACE" wait --for=condition=complete job/ldap-seed --timeout=90s >/dev/null
    fi
}

deploy_phoenix_helm() {
    local helm_args=(-f "$K8S_DIR/values/base.yaml")
    if has_profile "basic-auth"; then helm_args+=(-f "$K8S_DIR/values/basic-auth.yaml"); fi
    if has_profile "in-memory"; then helm_args+=(-f "$K8S_DIR/values/in-memory.yaml"); fi
    if has_profile "pkce-public"; then helm_args+=(-f "$K8S_DIR/values/pkce-public.yaml"); fi
    if has_profile "pkce-confidential"; then helm_args+=(-f "$K8S_DIR/values/pkce-confidential.yaml"); fi
    if has_profile "toxiproxy"; then helm_args+=(-f "$K8S_DIR/values/toxiproxy.yaml"); fi
    if has_profile "grafana"; then helm_args+=(-f "$K8S_DIR/values/grafana.yaml"); fi
    if has_profile "lgtm"; then helm_args+=(-f "$K8S_DIR/values/lgtm.yaml"); fi
    if has_profile "vite"; then helm_args+=(-f "$K8S_DIR/values/vite.yaml"); fi
    if has_profile "ldap"; then helm_args+=(-f "$K8S_DIR/values/ldap.yaml"); fi
    if has_profile "ldap-no-email"; then helm_args+=(-f "$K8S_DIR/values/ldap-no-email.yaml"); fi
    if has_profile "ldap-posix"; then helm_args+=(-f "$K8S_DIR/values/ldap-posix.yaml"); fi
    if has_profile "ldap-test"; then helm_args+=(-f "$K8S_DIR/values/ldap-test.yaml"); fi

    if [[ -n "$CURRENT_SCHEMA" ]]; then
        helm_args+=(--set "database.postgres.schema=$CURRENT_SCHEMA")
    fi

    log_info "Deploying Phoenix via Helm chart (./helm)..."
    local prev_px_hash new_px_hash
    prev_px_hash=$(
        {
            kctl -n "$NAMESPACE" get configmap phoenix-configmap -o json 2>/dev/null | jq -cS '.data' || true
            kctl -n "$NAMESPACE" get secret phoenix-secret -o json 2>/dev/null | jq -cS '.data' || true
        } | shasum -a 256 | awk '{print $1}'
    )
    hlm upgrade --install phoenix "$HELM_CHART_DIR" \
        --namespace "$NAMESPACE" \
        "${helm_args[@]}" >/dev/null
    new_px_hash=$(
        {
            kctl -n "$NAMESPACE" get configmap phoenix-configmap -o json 2>/dev/null | jq -cS '.data' || true
            kctl -n "$NAMESPACE" get secret phoenix-secret -o json 2>/dev/null | jq -cS '.data' || true
        } | shasum -a 256 | awk '{print $1}'
    )
    if [[ -n "$prev_px_hash" && "$prev_px_hash" != "$new_px_hash" ]]; then
        REBUILT_SERVICES+=("deployment/phoenix")
    fi

    # Restart any deployments whose local `:local` image tag or ConfigMap/Secret changed
    if [[ ${#REBUILT_SERVICES[@]} -gt 0 ]]; then
        local restarted=" "
        for target in "${REBUILT_SERVICES[@]}"; do
            if [[ "$restarted" != *" $target "* ]]; then
                kctl -n "$NAMESPACE" rollout restart "$target" >/dev/null 2>&1 || true
                restarted="${restarted}${target} "
            fi
        done
        if [[ "$restarted" == *" deployment/phoenix "* ]]; then
            kctl -n "$NAMESPACE" rollout status deployment/phoenix --timeout=120s >/dev/null
        fi
    fi
}

wait_for_phoenix() {
    if has_profile "ldap-test"; then
        log_info "Waiting for LDAP test Phoenix deployments..."
        kctl -n "$NAMESPACE" rollout status deployment/phoenix --timeout=120s
        return 0
    fi

    echo "⏳ Waiting for Phoenix to be ready at $HEALTH_URL..."
    local attempt=1
    while [[ $attempt -le $HEALTH_TIMEOUT ]]; do
        if curl -s -f "$HEALTH_URL" >/dev/null 2>&1; then
            echo ""
            log_success "Phoenix is ready!"
            return 0
        fi
        [[ $attempt -eq 1 ]] && echo -n "   Checking health"
        echo -n "."

        if [[ $attempt -eq $HEALTH_LOG_CHECK ]]; then
            echo ""
            echo "💡 Phoenix is taking longer than expected. Recent pod logs:"
            echo "────────────────────────────────────────────────────────"
            local logs
            logs=$(kctl -n "$NAMESPACE" logs deployment/phoenix --tail=80 2>&1 || true)
            echo "$logs"
            echo "────────────────────────────────────────────────────────"
            if echo "$logs" | grep -qi -E "(Traceback|phoenix\.exceptions)"; then
                log_error "Exception detected in Phoenix logs - stopping wait"
                echo "   Try: ./dev.sh destroy && ./dev.sh up"
                return 1
            fi
            echo -n "   Continuing to wait"
        fi

        sleep 1
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Phoenix health check failed after ${HEALTH_TIMEOUT} seconds"
    echo "   Check logs: kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE logs deployment/phoenix"
    return 1
}

wait_for_datagen() {
    if ! has_profile "datagen"; then
        return 0
    fi
    echo "⏳ Waiting for datagen to finish seeding..."
    local attempt=1
    while [[ $attempt -le $DATAGEN_TIMEOUT ]]; do
        if curl -s -f "$DATAGEN_STATE_URL" 2>/dev/null | grep -q '"phase"[[:space:]]*:[[:space:]]*"replaying"'; then
            echo ""
            log_success "Datagen is replaying!"
            return 0
        fi
        [[ $attempt -eq 1 ]] && echo -n "   Seeding"
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done

    echo ""
    log_error "Datagen seeding did not complete within ${DATAGEN_TIMEOUT} seconds"
    echo "   Check logs: kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE logs deployment/datagen"
    return 1
}

show_services() {
    echo "🌐 Web Services (Kubernetes: $BACKEND / $CLUSTER_NAME):"
    echo "  Phoenix:    http://localhost:${HTTP_PORT}/phoenix/"
    echo "  Mail:       http://localhost:${HTTP_PORT}/mail/"
    echo ""
    echo "📊 Direct Access:"
    echo "  Database:   localhost:${PG_PORT} (postgres/postgres)"
    echo "  Kubectl:    kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE get pods"

    if [[ -n "$CURRENT_PROFILES" ]]; then
        echo ""
        echo "🏷️  Active Profiles: $CURRENT_PROFILES"
        for profile in $CURRENT_PROFILES; do
            case "$profile" in
                pkce-public)
                    echo "  OAuth Mode: PKCE Public Client (no client secret)"
                    echo "  Grafana:    http://localhost:${HTTP_PORT}/grafana"
                    ;;
                pkce-confidential)
                    echo "  OAuth Mode: PKCE Confidential Client (with client secret)"
                    echo "  Grafana:    http://localhost:${HTTP_PORT}/grafana"
                    ;;
                vite)
                    echo "  Frontend:   Development mode (Vite pod + live file sync)"
                    echo "  Sync Logs:  $VITE_SYNC_LOG_FILE"
                    ;;
                in-memory)
                    echo "  Database:   In-memory SQLite"
                    ;;
                toxiproxy)
                    echo "  Database:   Phoenix connects through Toxiproxy (2ms ±1ms by default)"
                    echo "  Controls:   http://localhost:${HTTP_PORT}/toxiproxy/"
                    ;;
                grafana)
                    echo "  Monitoring: Grafana + Prometheus + Tempo + Loki + OTel Collector (kubelet cAdvisor)"
                    echo "  Grafana:    http://localhost:${HTTP_PORT}/grafana"
                    echo "  Prometheus: http://localhost:${HTTP_PORT}/prometheus/"
                    ;;
                lgtm)
                    echo "  Telemetry:   Phoenix metrics, logs and traces in Grafana (otel-lgtm)"
                    echo "  Grafana:     http://localhost:${HTTP_PORT}/lgtm/"
                    echo "  Grafana MCP: http://localhost:${HTTP_PORT}/grafana-mcp/mcp (read-only)"
                    ;;
                mock-llm)
                    echo "  Mock LLM:   http://mock-llm:57593/v1 (in-cluster)"
                    echo "  Dashboard:  http://localhost:${HTTP_PORT}/mock-llm/dashboard/"
                    ;;
                datagen)
                    echo "  Datagen:    replaying traces, one project per recorded application"
                    echo "  Controls:   http://localhost:${HTTP_PORT}/datagen/"
                    echo "  Logs:       kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE logs -f deployment/datagen"
                    ;;
                ldap|ldap-no-email|ldap-posix)
                    echo "  LDAP Admin: http://localhost:${LDAP_ADMIN_PORT} (cn=admin,dc=example,dc=com / admin_password)"
                    ;;
                ldap-test)
                    echo "  LDAP Suite: kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE logs -f deployment/ldap-test"
                    echo "  MITM Proxy: kubectl --kubeconfig $KUBECONFIG_PATH -n $NAMESPACE logs deployment/ldap-mitm-proxy"
                    ;;
                schema=*)
                    echo "  Schema:     $CURRENT_SCHEMA"
                    ;;
            esac
        done
    fi
}

show_status() {
    detect_backend
    log_info "Checking Kubernetes devops status (backend: $BACKEND)..."

    if ! cluster_exists || [[ ! -f "$KUBECONFIG_PATH" ]]; then
        log_warning "Cluster '$CLUSTER_NAME' is not running"
        echo "Use './dev.sh up [--profile PROFILE_NAME]' to start services"
        return 0
    fi

    if [[ -z "$CURRENT_PROFILES" && -f "$ACTIVE_PROFILES_FILE" ]]; then
        CURRENT_PROFILES="$(cat "$ACTIVE_PROFILES_FILE")"
    fi

    local pods
    pods=$(kctl -n "$NAMESPACE" get pods 2>/dev/null || true)
    if [[ -z "$pods" ]] || echo "$pods" | grep -q "No resources found"; then
        log_warning "Cluster '$CLUSTER_NAME' is running, but no pods are active in namespace '$NAMESPACE'"
        echo "Use './dev.sh up [--profile PROFILE_NAME]' to deploy services"
        return 0
    fi

    log_success "Services are deployed in '$NAMESPACE'"
    echo ""
    kctl -n "$NAMESPACE" get pods
    echo ""
    show_services
}

list_profiles() {
    cat <<'EOF'
📋 Available Profiles:

  (none)             Standard configuration (Phoenix + PostgreSQL + OIDC + SMTP + Traefik)
  vite               Enable Vite dev server in-cluster with live host->pod file sync
  pkce-public        PKCE Public Client (no client secret) + Grafana
  pkce-confidential  PKCE Confidential Client (with client secret) + Grafana
  basic-auth         Basic authentication (username/password)
  in-memory          In-memory SQLite database
  toxiproxy          Enable network simulation with Toxiproxy
  grafana            Enable Grafana, Prometheus, Tempo, Loki, and OTel Collector (kubelet cAdvisor)
  lgtm               Enable metrics, logs and traces in Grafana (otel-lgtm), with the Grafana MCP server
  mock-llm           Enable the mock LLM server (OpenAI, Anthropic, Gemini, TypeSafe)
  datagen            Replay synthetic traces (one project per application)
  ldap               Enable LDAP authentication (mock OpenLDAP server)
  ldap-no-email      Enable LDAP authentication (users without email)
  ldap-posix         Enable LDAP authentication (POSIX groups, no memberOf)
  ldap-test          Run the 17-service adversarial LDAP TLS + POSIX test suite
  schema=NAME        Dynamic schema profile (custom PostgreSQL schema)
EOF
}

check_port() {
    local port="$1"
    local purpose="$2"
    local listening=""
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && listening=1
    elif command -v nc >/dev/null 2>&1; then
        nc -z localhost "$port" >/dev/null 2>&1 && listening=1
    fi

    if [[ -z "$listening" ]]; then
        log_success "Port $port ($purpose) is free"
        return 0
    fi

    # Check if owned by our Apple container gateway or kind node
    if [[ "$BACKEND" == "apple-container" ]] && container inspect "$GATEWAY_NAME" 2>/dev/null | jq -e '.[0].status == "running"' >/dev/null 2>&1; then
        log_success "Port $port ($purpose) is in use by $GATEWAY_NAME"
    elif [[ "$BACKEND" == "kind" ]] && docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep "${CLUSTER_NAME}-control-plane" | grep -q ":${port}->"; then
        log_success "Port $port ($purpose) is in use by kind cluster $CLUSTER_NAME"
    else
        log_error "Port $port ($purpose) is in use by another process (stop Docker devops if running)"
        echo "   Find it with: lsof -nP -iTCP:$port -sTCP:LISTEN"
        DOCTOR_FAILED=1
    fi
}

run_doctor() {
    detect_backend
    DOCTOR_FAILED=0
    echo "🩺 Checking the Kubernetes development environment..."
    echo ""

    for bin in kubectl helm jq curl python3; do
        if command -v "$bin" >/dev/null 2>&1; then
            log_success "$bin found ($(command -v "$bin"))"
        else
            log_error "$bin not found"
            DOCTOR_FAILED=1
        fi
    done

    if [[ "$BACKEND" == "apple-container" ]]; then
        log_success "Backend: Apple container ($(container --version))"
        if container system status >/dev/null 2>&1; then
            log_success "Apple container daemon is running"
        else
            log_warning "Apple container daemon is stopped ('./dev.sh up' will start it)"
        fi
        if apple_container_kernel_configured; then
            log_success "Apple container default kernel is configured"
        else
            log_warning "Apple container default kernel is not configured ('./dev.sh up' will run 'container system kernel set --recommended')"
        fi
    elif [[ "$BACKEND" == "kind" ]]; then
        log_success "Backend: kind ($(kind --version))"
        if docker info >/dev/null 2>&1; then
            log_success "Docker daemon is running"
        else
            log_error "Docker daemon is not reachable"
            DOCTOR_FAILED=1
        fi
    else
        log_error "Neither Apple 'container' nor 'kind' is installed"
        echo "   Install Apple container: brew install container"
        DOCTOR_FAILED=1
    fi

    if helm template phoenix "$HELM_CHART_DIR" -n "$NAMESPACE" -f "$K8S_DIR/values/base.yaml" >/dev/null 2>&1; then
        log_success "Phoenix Helm chart & base values render cleanly"
    else
        log_error "Phoenix Helm chart failed template validation"
        DOCTOR_FAILED=1
    fi

    if kubectl kustomize "$K8S_DIR/manifests/base" >/dev/null 2>&1; then
        log_success "Kustomize base manifests render cleanly"
    else
        log_error "Kustomize base manifests failed validation"
        DOCTOR_FAILED=1
    fi

    echo ""
    check_port "$HTTP_PORT" "Traefik gateway: Phoenix, mail, OIDC, mock LLM, datagen, Toxiproxy"
    check_port "$PG_PORT" "PostgreSQL"

    echo ""
    if [[ "$DOCTOR_FAILED" -eq 0 ]]; then
        log_success "No problems found"
    else
        log_error "Problems found; see the fixes above"
        exit 1
    fi
}

parse_args "$@"

case "${COMMAND:-help}" in
    doctor|help|profiles) ;;
    *) check_dependencies ;;
esac

case "${COMMAND:-help}" in
    up)
        echo "$CURRENT_PROFILES" > "$ACTIVE_PROFILES_FILE"
        if [[ -n "$CURRENT_PROFILES" ]]; then
            log_info "Starting Phoenix K8s environment ($BACKEND) with profiles: $CURRENT_PROFILES"
        else
            log_info "Starting Phoenix K8s environment ($BACKEND, standard mode)"
        fi

        ensure_cluster
        build_required_images 0
        sync_shared_configmaps
        render_and_apply_manifests
        deploy_phoenix_helm
        ensure_gateway
        start_vite_sync

        if wait_for_phoenix && wait_for_datagen; then
            log_success "Environment ready!"
            show_services
        else
            log_error "Failed to start Phoenix K8s environment"
            exit 1
        fi
        ;;

    rebuild)
        if [[ "$PROFILES_EXPLICIT" -eq 0 && -f "$ACTIVE_PROFILES_FILE" ]]; then
            for p in $(cat "$ACTIVE_PROFILES_FILE"); do add_profile "$p"; done
        fi
        echo "$CURRENT_PROFILES" > "$ACTIVE_PROFILES_FILE"
        log_info "Force rebuilding images without cache ($BACKEND)..."

        ensure_cluster
        build_required_images 1
        sync_shared_configmaps
        render_and_apply_manifests
        deploy_phoenix_helm
        ensure_gateway
        start_vite_sync

        if wait_for_phoenix && wait_for_datagen; then
            log_success "Environment ready!"
            show_services
        else
            log_error "Failed to start Phoenix K8s environment"
            exit 1
        fi
        ;;

    down)
        log_info "Stopping services (preserving cluster and persistent volumes)..."
        stop_vite_sync
        stop_gateway
        if cluster_exists && [[ -f "$KUBECONFIG_PATH" ]]; then
            hlm uninstall phoenix -n "$NAMESPACE" >/dev/null 2>&1 || true
            kctl -n "$NAMESPACE" delete deployment,statefulset,job,service,configmap,secret --all --ignore-not-found >/dev/null 2>&1 || true
        fi
        log_success "All workloads stopped (PVCs kept; run './dev.sh destroy' to wipe data or './dev.sh clean' to delete the cluster)"
        ;;

    destroy)
        log_warning "Destroying all persistent data (PostgreSQL, Grafana, Prometheus, Tempo, Loki, LGTM, Datagen)..."
        if [[ "$ASSUME_YES" != "true" ]]; then
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
        else
            REPLY="y"
        fi
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stop_vite_sync
            stop_gateway
            if cluster_exists && [[ -f "$KUBECONFIG_PATH" ]]; then
                hlm uninstall phoenix -n "$NAMESPACE" >/dev/null 2>&1 || true
                kctl delete namespace "$NAMESPACE" --ignore-not-found >/dev/null 2>&1 || true
            fi
            rm -f "$ACTIVE_PROFILES_FILE"
            log_success "All data destroyed! Run './dev.sh up' to start fresh."
        else
            log_error "Operation cancelled."
        fi
        ;;

    reset)
        log_info "Resetting built image hashes and local images..."
        stop_vite_sync
        rm -rf "$STATE_DIR/image-hashes"
        if [[ "$BACKEND" == "apple-container" ]]; then
            for img in devops-phoenix devops-phoenix-vite devops-oidc-dev devops-smtp-dev devops-mock-llm devops-vite-dev; do
                container image delete "docker.io/library/${img}:local" >/dev/null 2>&1 || true
            done
        else
            for img in devops-phoenix devops-phoenix-vite devops-oidc-dev devops-smtp-dev devops-mock-llm devops-vite-dev; do
                docker image rm "docker.io/library/${img}:local" >/dev/null 2>&1 || true
            done
        fi
        log_success "Image hashes cleared; next './dev.sh up' will rebuild and reload all images."
        ;;

    prune)
        if [[ "$BACKEND" == "apple-container" ]]; then
            log_info "Pruning stopped containers and builder cache in Apple container..."
            container builder stop >/dev/null 2>&1 || true
            container builder delete >/dev/null 2>&1 || true
            log_success "Apple container builder cache cleaned!"
        else
            docker builder prune -a -f >/dev/null 2>&1
            log_success "Docker builder cache cleaned!"
        fi
        ;;

    clean)
        log_warning "Deleting local Kubernetes cluster '$CLUSTER_NAME', gateway, and all state..."
        if [[ "$ASSUME_YES" != "true" ]]; then
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
        else
            REPLY="y"
        fi
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stop_vite_sync
            stop_gateway
            if [[ "$BACKEND" == "apple-container" ]]; then
                container cluster delete --name "$CLUSTER_NAME" >/dev/null 2>&1 || true
            else
                kind delete cluster --name "$CLUSTER_NAME" >/dev/null 2>&1 || true
            fi
            rm -rf "$STATE_DIR"
            log_success "Cluster '$CLUSTER_NAME' deleted!"
        else
            log_error "Operation cancelled."
        fi
        ;;

    status)
        show_status
        ;;

    profiles)
        list_profiles
        ;;

    doctor)
        run_doctor
        ;;

    env)
        if ! cluster_exists || [[ ! -f "$KUBECONFIG_PATH" ]]; then
            log_error "Cluster '$CLUSTER_NAME' is not running" >&2
            exit 1
        fi
        kctl -n "$NAMESPACE" exec deployment/phoenix -c phoenix -- env | grep '^PHOENIX_' | sort
        ;;

    seed|seed-tail|psql)
        if ! cluster_exists || [[ ! -f "$KUBECONFIG_PATH" ]] || ! kctl -n "$NAMESPACE" get pod db-0 >/dev/null 2>&1; then
            log_error "The PostgreSQL pod (db-0) is not running. Start the stack first: ./dev.sh up"
            exit 1
        fi
        run_psql() { kctl -n "$NAMESPACE" exec -i pod/db-0 -c postgresql -- psql -U postgres -p 5433 -d postgres -X "$@"; }
        case "$COMMAND" in
            seed)
                log_info "Seeding performance data at scale $SEED_SCALE (scale 1 is 1.94 million spans, about a minute)..."
                run_psql -q -v scale="$SEED_SCALE" < "$DEV_DIR/scripts/seed-perf-data.sql"
                ;;
            seed-tail)
                log_info "Adding fresh traffic to the seeded busy projects..."
                run_psql -q < "$DEV_DIR/scripts/seed-perf-tail.sql"
                ;;
            psql)
                if [[ -t 0 ]]; then
                    kctl -n "$NAMESPACE" exec -it pod/db-0 -c postgresql -- psql -U postgres -p 5433 -d postgres
                else
                    run_psql
                fi
                ;;
        esac
        ;;

    kubectl)
        shift || true
        kctl -n "$NAMESPACE" "$@"
        ;;

    help|""|*)
        cat <<'EOF'
Phoenix Kubernetes Development Environment (Apple container / kind)

🚀 Commands:
  up [--profile NAME]      Create cluster (if needed), build changed images, and deploy (DEFAULT)
  rebuild [--profile NAME] Force rebuild images without cache and redeploy
  down                     Stop workloads & gateway while keeping cluster & PVCs
  destroy [-y|--yes]       Delete phoenix-devops namespace and wipe all PVCs
  reset                    Clear cached local devops images so next 'up' rebuilds them
  prune                    Clean image builder cache
  clean [-y|--yes]         Delete the local Kubernetes cluster and all state
  seed [--scale N]         Fill PostgreSQL with performance test data
  seed-tail                Add fresh traffic to the seeded busy projects
  psql                     Open psql in the PostgreSQL pod (or pipe SQL to it)
  doctor                   Check CLI dependencies, cluster backend, manifests, and host ports
  status                   Show pod status and active URLs
  profiles                 List available profiles
  env                      Print PHOENIX_* environment variables from the Phoenix pod

🏷️  Options:
  --profile NAME           Enable a single profile
  --profiles NAME1,NAME2   Enable multiple comma-separated profiles
  --backend NAME           Force cluster backend: apple-container (default on Mac) or kind

🌐 Access:
  Phoenix:    http://localhost:18273/phoenix/
  Mail:       http://localhost:18273/mail/
  Database:   localhost:5433 (postgres/postgres)
EOF
        ;;
esac
