This directory contains a set of manifests and overlays that describe our various Kubernetes deployment options.
These deployments can be invoked from the repository root.

Examples:

```shell
kubectl apply -k kustomize/base
```

will yield a single node deployment of Phoenix with PostgreSQL

To add the optional synthetic trace generator, run:

```shell
kubectl apply -k kustomize/datagen
```

This overlay adds a `phoenix-datagen` Deployment and an internal Phoenix Service. Edit
`kustomize/datagen/deployment.yaml` to tune the project, rate, epsilon, or seed.
