---
description: How to self-host a phoenix instance
---

# Self-hosting

## Deployment

**Docker:** ![](data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20width%3D%22136%22%20height%3D%2220%22%20role%3D%22img%22%20aria-label%3D%22version%3A%20version-5.5.2%22%3E%3Ctitle%3Eversion%3A%20version-5.5.2%3C%2Ftitle%3E%3ClinearGradient%20id%3D%22s%22%20x2%3D%220%22%20y2%3D%22100%25%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%23bbb%22%20stop-opacity%3D%22.1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-opacity%3D%22.1%22%2F%3E%3C%2FlinearGradient%3E%3CclipPath%20id%3D%22r%22%3E%3Crect%20width%3D%22136%22%20height%3D%2220%22%20rx%3D%223%22%20fill%3D%22%23fff%22%2F%3E%3C%2FclipPath%3E%3Cg%20clip-path%3D%22url\(%23r\)%22%3E%3Crect%20width%3D%2251%22%20height%3D%2220%22%20fill%3D%22%23555%22%2F%3E%3Crect%20x%3D%2251%22%20width%3D%2285%22%20height%3D%2220%22%20fill%3D%22%23007ec6%22%2F%3E%3Crect%20width%3D%22136%22%20height%3D%2220%22%20fill%3D%22url\(%23s\)%22%2F%3E%3C%2Fg%3E%3Cg%20fill%3D%22%23fff%22%20text-anchor%3D%22middle%22%20font-family%3D%22Verdana%2CGeneva%2CDejaVu%20Sans%2Csans-serif%22%20text-rendering%3D%22geometricPrecision%22%20font-size%3D%22110%22%3E%3Ctext%20aria-hidden%3D%22true%22%20x%3D%22265%22%20y%3D%22150%22%20fill%3D%22%23010101%22%20fill-opacity%3D%22.3%22%20transform%3D%22scale\(.1\)%22%20textLength%3D%22410%22%3Eversion%3C%2Ftext%3E%3Ctext%20x%3D%22265%22%20y%3D%22140%22%20transform%3D%22scale\(.1\)%22%20fill%3D%22%23fff%22%20textLength%3D%22410%22%3Eversion%3C%2Ftext%3E%3Ctext%20aria-hidden%3D%22true%22%20x%3D%22925%22%20y%3D%22150%22%20fill%3D%22%23010101%22%20fill-opacity%3D%22.3%22%20transform%3D%22scale\(.1\)%22%20textLength%3D%22750%22%3Eversion-5.5.2%3C%2Ftext%3E%3Ctext%20x%3D%22925%22%20y%3D%22140%22%20transform%3D%22scale\(.1\)%22%20fill%3D%22%23fff%22%20textLength%3D%22750%22%3Eversion-5.5.2%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E)

Phoenix is designed to be extremely portable and can run as a container or in a notebook.

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td></td><td>Quickstart</td><td>How to deploy an LLM application with Phoenix observability</td><td><a href="../.gitbook/assets/quickstart.png">quickstart.png</a></td><td><a href="deploying-phoenix.md">deploying-phoenix.md</a></td></tr><tr><td>Hosted Phoenix</td><td>Try a free cloud instance of Phoenix through our website</td><td></td><td><a href="../.gitbook/assets/Screenshot 2024-10-09 at 6.34.18 PM.png">Screenshot 2024-10-09 at 6.34.18 PM.png</a></td><td><a href="../hosted-phoenix.md">hosted-phoenix.md</a></td></tr><tr><td></td><td>Persistence</td><td>How to setup a persistent disc or database</td><td><a href="../.gitbook/assets/persistence.png">persistence.png</a></td><td><a href="persistence.md">persistence.md</a></td></tr><tr><td></td><td>Kubernetes</td><td>How to deploy Phoenix on K8s</td><td><a href="../.gitbook/assets/k8s.png">k8s.png</a></td><td><a href="kubernetes.md">kubernetes.md</a></td></tr><tr><td></td><td>Docker</td><td>How to deploy Phoenix using Docker</td><td><a href="../.gitbook/assets/docker.png">docker.png</a></td><td><a href="docker.md">docker.md</a></td></tr><tr><td>Python Notebook</td><td>How to use Phoenix in a Jupyter notebook</td><td></td><td></td><td></td></tr><tr><td>Command line</td><td>How to run Phoenix locally from terminal</td><td></td><td></td><td></td></tr></tbody></table>

## Configure Phoenix

* [Available ports to run phoenix](configuration.md#ports)
* [Customize phoenix using environment variables](configuration.md#environment-variables)

## Setup Authentication

* [Setup authentication](authentication.md)
* Configuring OAuth2 (Google, AWS Cognito)

## Images

This table lists the images we publish that can be used to run Phoenix.

<table data-full-width="false"><thead><tr><th width="440">Image Tag</th><th>Description</th></tr></thead><tbody><tr><td><code>arizephoenix/phoenix:latest</code></td><td>Latest released version of Phoenix using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:latest-nonroot</code></td><td>Latest released version of Phoenix using nonroot permissions. <strong>Ensure the image has the required filesystem permissions before using.</strong></td></tr><tr><td><code>arizephoenix/phoenix:latest-debug</code></td><td>Latest released version of Phoenix using a debug base image.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X</code></td><td>Build for a specific release version using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-nonroot</code></td><td>Build for a specific release version using nonroot permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-debug</code></td><td>Build for a specific release version using a debug image.</td></tr></tbody></table>

## Services

You can deploy Phoenix on any cloud provider or on-premise. Here are some services that Phoenix can be deployed on:

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/PTHRoq?referralCode=Xe2txW)
