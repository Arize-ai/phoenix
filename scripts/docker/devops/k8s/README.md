# K8s Test Setup for ROLE_ATTRIBUTE_PATH

This setup tests whether `ROLE_ATTRIBUTE_PATH` works with a constant value (e.g., `'MEMBER'`) 
without requiring `ROLE_MAPPING` in a Kubernetes environment.

## Prerequisites

- Docker Desktop with Kubernetes enabled
- kubectl configured to access the cluster
- Helm 3.x

## Setup

### 1. Verify you're using Docker Desktop (NOT production!)

```bash
# Check current context - MUST be "docker-desktop"
kubectl config current-context

# If not docker-desktop, switch to it:
kubectl config use-context docker-desktop

# Double-check you're on the right cluster before proceeding
kubectl cluster-info
```

> **⚠️ WARNING**: Do NOT proceed if your context is pointing to a production cluster!

### 2. Build the OIDC dev image

```bash
cd scripts/docker/devops

# Build the image (Docker Desktop K8s uses the same Docker daemon, so no need to load)
docker build -t oidc-dev:local ./oidc-server
```

### 3. Deploy Postgres

```bash
kubectl apply -f k8s/postgres.yml

# Wait for Postgres to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=60s
```

### 4. Deploy Phoenix with OIDC sidecar

```bash
# Apply the OAuth secret (contains ROLE_ATTRIBUTE_PATH='MEMBER' with NO ROLE_MAPPING)
kubectl apply -f k8s/test-secret.yml

# Install Phoenix via Helm (path is relative to scripts/docker/devops)
helm install phoenix ../../../helm -f k8s/test-values.yml

# Add OIDC dev server as sidecar to Phoenix pod
kubectl patch deployment phoenix --patch-file k8s/phoenix-oidc-sidecar-patch.yml

# Wait for Phoenix to be ready (may take a moment after patch)
kubectl wait --for=condition=ready pod -l app=phoenix --timeout=120s
```

### 5. Verify the environment variable

```bash
# Check that the secret value is correctly set
kubectl get secret phoenix-oauth-test -o jsonpath='{.data.PHOENIX_OAUTH2_DEV_ROLE_ATTRIBUTE_PATH}' | base64 -d && echo

# Expected output: 'MEMBER' (with single quotes)
```

### 6. Test the OIDC login

```bash
# Port-forward both Phoenix (6006) and OIDC sidecar (9000) from the same pod
kubectl port-forward deploy/phoenix 6006:6006 9000:9000
```

Then:
1. Open http://localhost:6006 in your browser
2. Click "Login with OIDC Dev"
3. You'll be automatically logged in as a test user
4. Verify the user's role by querying the database:

```bash
kubectl exec deploy/postgres -- psql -U postgres -d postgres -c \
  "SELECT u.username, u.email, r.name as role FROM users u JOIN user_roles r ON u.user_role_id = r.id WHERE u.oauth2_client_id IS NOT NULL;"
```

5. **Expected**: User should have MEMBER role (not VIEWER)

## What we're testing

The key question: Does `ROLE_ATTRIBUTE_PATH='MEMBER'` (a constant JMESPath expression) 
correctly assign the MEMBER role without needing `ROLE_MAPPING`?

## Cleanup

```bash
helm uninstall phoenix
kubectl delete -f k8s/test-secret.yml
kubectl delete -f k8s/postgres.yml
```
