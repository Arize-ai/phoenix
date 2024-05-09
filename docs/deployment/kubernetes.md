# Kubernetes

Phoenix can be deployed on Kubernetes with either SQLite backed by a persistent disc or with PostgreSQL.

{% hint style="info" %}
Note that the following commands will deploy the latest
{% endhint %}

## Prerequisites[​](https://docs.smith.langchain.com/self\_hosting/kubernetes#prerequisites)

You must have a working Kubernetes cluster accessible via `kubectl`.

## SQLite with a StatefulSet

{% tabs %}
{% tab title="Via Kustomize" %}
Clone the Arize-Phoenix repository:

```sh
git clone https://github.com/Arize-ai/phoenix.git
```

From the repository root, apply the `kustomize` configuration for SQLite:

```sh
kubectl apply -k kustomize/base
```

This will yield a single node deployment of Phoenix with a local SQLite.
{% endtab %}

{% tab title="Via a Manual Manifest" %}
Copy the manifest below into a file named `phoenix.yaml`.

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
{% endtab %}
{% endtabs %}

## PostgreSQL

Manifests for PostgreSQL tend to be complex, so we recommend using `kustomize`.

Clone the Arize-Phoenix repository:

```sh
git clone https://github.com/Arize-ai/phoenix.git
```

From the repository root, apply the `kustomize` configuration for PostgreSQL:

```sh
kubectl apply -k kustomize/backends/postgres
```

This will yield a single node deployment of Phoenix pointed to a remote PostgreSQL.
