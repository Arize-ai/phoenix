This directory contains a set of manifests and overlays that describe our various Kubernetes deployment options.
These deployments can be invoked from the repository root.

## Base

```shell
kubectl apply -k kustomize/base
```

will yield a single node deployment of Phoenix with PostgreSQL.

Phoenix stores its data in PostgreSQL, so no persistent volume is mounted for Phoenix
itself and `PHOENIX_WORKING_DIR` is deliberately left unset — Phoenix only runs without
local storage when a PostgreSQL connection string is set *and* no working directory is
configured. PostgreSQL keeps its own volume claim.

## Auth

```shell
# Phoenix reads its signing key from a secret; create it once before applying the overlay.
kubectl create secret generic phoenix-secret \
  --from-literal=secret-key="$(openssl rand -hex 32)"

kubectl apply -k kustomize/auth
```

will yield the same deployment with authentication enabled.
