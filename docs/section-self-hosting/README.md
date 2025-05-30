---
description: How to self-host a Phoenix instance
---

# Self-Hosting

## Architecture

<figure><img src="https://storage.cloud.google.com/arize-assets/phoenix/assets/images/phoenix-architecture.png" alt=""><figcaption><p>Phoenix running on your virtual private cloud</p></figcaption></figure>

Phoenix is a containerized application designed to collect and analyze  traces from your LLM or AI application. It operates with a SQL database backend and provides a robust tracing UI. By default, Phoenix uses SQLite for storage, but it can be configured to use PostgreSQL for production deployments.

### SQLite

By default, Phoenix uses SQLite, storing data in `~/.phoenix/` or the directory specified by the **PHOENIX_WORKING_DIR** environment variable. This allows for simple deployments using a volume mount, making it easy to get started without additional database setup.

### PostgreSQL

For production and scalable deployments, Phoenix supports PostgreSQL. Configure the **PHOENIX_SQL_DATABASE_URL** environment variable to connect Phoenix to your PostgreSQL instance.

{% hint style="info" %}
See the [SQLite](https://docs.arize.com/phoenix/self-hosting/deployment-options/kubernetes#sqlite-with-a-statefulset) and [PostgreSQL](https://docs.arize.com/phoenix/self-hosting/deployment-options/kubernetes#postgresql) sections for details.
{% endhint %}

## Deployment Options

Phoenix can be deployed using several methods, including Docker and Kubernetes. Choose the option that best fits your infrastructure and operational requirements.

{% hint style="info" %}
For other ways to run Phoenix, including Phoenix Cloud, see [Phoenix Deployments](https://docs.arize.com/phoenix/environments).
{% endhint %}

<table data-card-size="large" data-view="cards"><thead><tr><th></th><th></th><th></th><th data-hidden data-card-cover data-type="files"></th><th data-hidden data-card-target data-type="content-ref"></th></tr></thead><tbody><tr><td></td><td><strong>Docker</strong></td><td>How to deploy Phoenix using Docker</td><td></td><td><a href="https://docs.arize.com/phoenix/self-hosting/deployment-options/docker">https://docs.arize.com/phoenix/self-hosting/deployment-options/docker</a></td></tr><tr><td></td><td><strong>Kubernetes</strong></td><td>How to deploy Phoenix on K8S</td><td></td><td><a href="https://docs.arize.com/phoenix/self-hosting/deployment-options/kubernetes">https://docs.arize.com/phoenix/self-hosting/deployment-options/kubernetes</a></td></tr></tbody></table>

## Configure Phoenix

* See available [ports](https://docs.arize.com/phoenix/self-hosting/configuration#ports) to run Phoenix
* Customize Phoenix using [environment variables](https://docs.arize.com/phoenix/self-hosting/configuration#environment-variables)

## Setup Authentication

* Setup [authentication](https://docs.arize.com/phoenix/self-hosting/authentication)
* Configuring [OAuth2 identity providers](https://docs.arize.com/phoenix/self-hosting/authentication#configuring-oauth2-identity-providers)

## Images

This table lists the [images](https://hub.docker.com/r/arizephoenix/phoenix/tags) we publish that can be used to run Phoenix.

<table data-full-width="false"><thead><tr><th width="440">Image Tag</th><th>Description</th></tr></thead><tbody><tr><td><code>arizephoenix/phoenix:latest</code></td><td>Latest released version of Phoenix using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:latest-nonroot</code></td><td>Latest released version of Phoenix using nonroot permissions. <strong>Ensure the image has the required filesystem permissions before using.</strong></td></tr><tr><td><code>arizephoenix/phoenix:latest-debug</code></td><td>Latest released version of Phoenix using a debug base image.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X</code></td><td>Build for a specific release version using root permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-nonroot</code></td><td>Build for a specific release version using nonroot permissions.</td></tr><tr><td><code>arizephoenix/phoenix:version-X.X.X-debug</code></td><td>Build for a specific release version using a debug image.</td></tr></tbody></table> 