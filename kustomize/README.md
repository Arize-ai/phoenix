This directory contains a set of manifests and overlays that describe our various Kubernetes deployment options.
These deployments can be invoked from the repository root.

Examples:

```shell
kubectl apply -k kustomize/base
```

will yield a single node deployment of Phoenix with PostgreSQL
