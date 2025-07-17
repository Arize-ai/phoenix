---
description: >-
  Phoenix can be deployed on Kubernetes with PostgreSQL using kustomize.
---

# Kubernetes

## Prerequisites​

You must have a working Kubernetes cluster accessible via `kubectl`.

## PostgreSQL with Kustomize

The kustomize deployment uses PostgreSQL as the database backend. This is the recommended approach for production deployments.

Clone the Arize-Phoenix repository:

```sh
git clone https://github.com/Arize-ai/phoenix.git
```

From the repository root, apply the kustomize configuration:

```sh
kubectl apply -k kustomize/base
```

This will deploy:
- Phoenix application configured to use PostgreSQL
- PostgreSQL database with persistent storage
