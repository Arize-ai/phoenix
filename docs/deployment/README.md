---
description: How to self-host a phoenix instance
---

# Deployment

[![](https://camo.githubusercontent.com/63d36979ad4d1307931b2e7388f90bf5c14024b3d43baccfea1dabf890444d54/68747470733a2f2f696d672e736869656c64732e696f2f646f636b65722f762f6172697a6570686f656e69782f70686f656e69783f736f72743d73656d766572266c6f676f3d646f636b6572266c6162656c3d696d61676526636f6c6f723d626c7565)](https://hub.docker.com/r/arizephoenix/phoenix/tags)

Phoenix can natively be run as a container that collects traces and evaluations as you run them.

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td></td><td>Quickstart</td><td>How to deploy an LLM application with Phoenix observability</td><td><a href="../.gitbook/assets/quickstart.png">quickstart.png</a></td><td><a href="deploying-phoenix.md">deploying-phoenix.md</a></td></tr><tr><td>Hosted Phoenix</td><td>Try a free cloud instance of Phoenix through our website</td><td></td><td><a href="../.gitbook/assets/Screenshot 2024-10-09 at 6.34.18 PM.png">Screenshot 2024-10-09 at 6.34.18 PM.png</a></td><td><a href="hosted-phoenix.md">hosted-phoenix.md</a></td></tr><tr><td></td><td>Persistence</td><td>How to setup a persistent disc or database</td><td><a href="../.gitbook/assets/persistence.png">persistence.png</a></td><td><a href="persistence.md">persistence.md</a></td></tr><tr><td></td><td>Kubernetes</td><td>How to deploy Phoenix on K8s</td><td><a href="../.gitbook/assets/k8s.png">k8s.png</a></td><td><a href="kubernetes.md">kubernetes.md</a></td></tr><tr><td></td><td>Docker</td><td>How to deploy Phoenix using Docker</td><td><a href="../.gitbook/assets/docker.png">docker.png</a></td><td><a href="docker.md">docker.md</a></td></tr></tbody></table>

# Images

This table lists the images we publish that can be used to run Phoenix.

<table data-full-width="false"><thead><tr><th width="440">Image Tag</th><th>Description</th></tr></thead><tbody><tr><td><code>arizephoenix/phoenix:latest</code></td><td>Latest released version of Phoenix using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:latest-nonroot</code></td><td>Latest released version of Phoenix using nonroot permissions. <strong>Ensure the image has the required filesystem permissions before using.</strong></td></tr><tr><td><code>arizephoenix/phoenix:latest-debug</code></td><td>Latest released version of Phoenix using a debug base image.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X</code></td><td>Build for a specific release version using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-nonroot</code></td><td>Build for a specific release version using nonroot permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-debug</code></td><td>Build for a specific release version using a debug image.</td></tr></tbody></table>


# Services

You can deploy Phoenix on any cloud provider or on-premise. Here are some services that Phoenix can be deployed on:

## Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/PTHRoq?referralCode=Xe2txW)
