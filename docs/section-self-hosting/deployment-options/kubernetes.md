---
description: >-
  Phoenix can be deployed on Kubernetes with PostgreSQL using kustomize or with SQLite using a manual manifest.
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

## SQLite with a Manual Manifest

{% hint style="info" %}
SQLite is no longer supported via kustomize. If you need SQLite, you must use the manual manifest approach below.
{% endhint %}

{% hint style="info" %}
We love SQLite! However it might not be the best choice of database if you have a need for a high volume of reads and writes (e.g. you have multiple applications and users using your application simultaneously).
{% endhint %}

For SQLite deployments, use the following manual manifest:

```yaml
# phoenix.yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: phoenix
  name: phoenix
spec:
  ports:
  - port: 443
    protocol: TCP
    targetPort: 6006
  selector:
    app: phoenix
  type: ClusterIP
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: phoenix
  namespace: phoenix
spec:
  replicas: 1
  selector:
    matchLabels:
      app: phoenix
  template:
    metadata:
      # Assume k8s pod service discovery for prometheus
      annotations:
        prometheus.io/path: /metrics
        prometheus.io/port: "9090"
        prometheus.io/scrape: "true"
      labels:
        app: phoenix
    spec:
      containers:
      - args:
        - -m
        - phoenix.server.main
        - serve
        command:
        - python
        env:
        - name: PHOENIX_WORKING_DIR
          value: /mnt/data
        # The version of phoenix you want should be used here  
        image: docker.io/arizephoenix/phoenix:version-4.0.0
        ports:
        - containerPort: 6006
        - containerPort: 4317
        - containerPort: 9090
        volumeMounts:
        - mountPath: /mnt/data
          name: phoenix
  volumeClaimTemplates:
  - metadata:
      name: phoenix
    spec:
      resources:
        requests:
          storage: 8Gi
```

Apply the manifest:

```sh
kubectl apply -f phoenix.yaml
```
