This directory contains a set of manifests and overlays that describe our various kubernetes deployment options.
These deployments can be invoked from the respository root.

Examples:

```shell
kubectl apply -k kustomize/base
```

will yield a single node deployment of Phoenix with PostgreSQL

```shell
kubectl apply -k kustomize/auth
```

will yield a single node deployment of Phoenix with PostgreSQL and authentication enabled
