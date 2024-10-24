---
description: >-
  The easiest way to run Phoenix is locally in your own computer. To launch
  Phoenix, use the following steps.
---

# Quickstart

## Install

{% tabs %}
{% tab title="pip" %}
```bash
pip install arize-phoenix
```
{% endtab %}

{% tab title="pipx" %}
```bash
pipx install arize-phoenix
```
{% endtab %}

{% tab title="conda" %}
```bash
conda install -c conda-forge arize-phoenix
```
{% endtab %}

{% tab title="Docker" %}
Phoenix server images are available via [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix) and can be used via [docker compose ](deployment/docker.md)or if you simply want a long-running phoenix instance to share with your team.

```bash
docker pull arizephoenix/phoenix:latest
```
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If you don't want to host an instance of Phoenix yourself or use a notebook instance, you can use a persistent instance provided on our site. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

For more details, see [hosted-phoenix.md](deployment/hosted-phoenix.md "mention")
{% endtab %}
{% endtabs %}

## Launch Phoenix

Launching phoenix can be done in many ways depending on your use-case.

{% tabs %}
{% tab title="Command Line" %}
For `arize-phoenix>=5.2.0`, launch Phoenix with

```bash
phoenix serve
```

For older versions of Phoenix, use

```
python -m phoenix.server.main serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).
{% endtab %}

{% tab title="Docker" %}
Launch the phoenix docker image using:

```bash
docker run -p 6006:6006 -p 4317:4317 arizephoenix/phoenix:latest
```

This will expose the Phoenix UI and REST API on `localhost:6006` and exposes the gRPC endpoint for spans on `localhost:4317`

For more details on customizing a docker deployment, see [docker.md](deployment/docker.md "mention")
{% endtab %}

{% tab title="Notebook" %}
Within your notebook, launch Phoenix using:

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [persistence.md](deployment/persistence.md "mention") or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
Hosted Phoenix instances are always online. Nothing more to do here!
{% endtab %}
{% endtabs %}

## Connect your App

To collect traces from your application, you must configure an OpenTelemetry TracerProvider to send traces to Phoenix. The `register` utility from the `phoenix.otel` module streamlines this process.

{% tabs %}
{% tab title="Python" %}
If `arize-phoenix` is not installed in your python environment, you can use `arize-phoenix-otel` to quickly connect to your phoenix instance.

```bash
pip install arize-phoenix-otel
```

Connect your application to your instance using:

```python
from phoenix.otel import register

# defaults to endpoint="http://localhost:4317"
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:4317",  # Sends traces using gRPC
)  
```

{% hint style="info" %}
You do not have to use phoenix.otel to connect to your phoenix instance, you can use OpenTelemetry itself to initialize your OTEL connection. See[using-otel-python-directly.md](tracing/how-to-tracing/setup-tracing/setup-tracing-python/using-otel-python-directly.md "mention")
{% endhint %}

See [setup-tracing-python](tracing/how-to-tracing/setup-tracing/setup-tracing-python/ "mention") for more details on configuration and setup
{% endtab %}

{% tab title="TypeScript" %}
For setting up tracing and OpenTelemetry with TypeScript, see [setup-tracing-ts.md](tracing/how-to-tracing/setup-tracing/setup-tracing-ts.md "mention")
{% endtab %}

{% tab title="Notebook" %}
Connect your notebook to Phoenix:

```python
from phoenix.otel import register

# defaults to endpoint="http://localhost:4317"
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:4317",  # Sends traces using gRPC
) 
```
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If `arize-phoenix` is not installed in your python environment, you can use `arize-phoenix-otel` to quickly connect to your phoenix instance.

```bash
pip install arize-phoenix-otel
```

Connect your application to your cloud instance using:

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
os.environ["PHOENIX_CLIENT_HEADERS"] = "api_key=...:..."

# configure the Phoenix tracer
register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="https://app.phoenix.arize.com/v1/traces",
) 
```

Your Phoenix API key can be found on the Keys section of your dashboard.
{% endtab %}
{% endtabs %}

## Next Steps

* [Trace](tracing/llm-traces-1.md) a running application
* Run [evaluations](evaluation/evals.md) on traces
* Test changes to you prompts, models, and application via [experiments](datasets-and-experiments/how-to-experiments/run-experiments.md)
