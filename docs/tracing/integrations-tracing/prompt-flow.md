---
description: Create flows using Microsoft PromptFlow and send their traces to Phoenix
hidden: true
---

# Prompt flow

This integration will allow you to trace [Microsoft PromptFlow](https://github.com/microsoft/promptflow) flows and send their traces into[`arize-phoenix`](https://github.com/Arize-ai/phoenix).

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Cloud" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint and API Key:**

```python
import os

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://arize.com/docs/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

See [Terminal](../../environments.md#terminal) for more details
{% endtab %}

{% tab title="Docker" %}
**Pull latest Phoenix image from** [**Docker Hub**](https://hub.docker.com/r/arizephoenix/phoenix)**:**

```bash
docker pull arizephoenix/phoenix:latest
```

**Run your containerized instance:**

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Set your Phoenix endpoint:**

```python
import os

os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "http://localhost:6006"
```

For more info on using Phoenix with Docker, see [Docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker).
{% endtab %}

{% tab title="Notebook" %}
**Install packages:**

```bash
pip install arize-phoenix
```

**Launch Phoenix:**

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://arize.com/docs/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install promptflow
```

## Setup

Set up the OpenTelemetry endpoint to point to Phoenix and use Prompt flow's `setup_exporter_from_environ` to start tracing any further flows and LLM calls.

```python
import os
from opentelemetry.sdk.environment_variables import OTEL_EXPORTER_OTLP_ENDPOINT
from promptflow.tracing._start_trace import setup_exporter_from_environ

endpoint = f"{os.environ["PHOENIX_COLLECTOR_ENDPOINT]}/v1/traces" # replace with your Phoenix endpoint if self-hosting
os.environ[OTEL_EXPORTER_OTLP_ENDPOINT] = endpoint
setup_exporter_from_environ()
```

## Run PromptFlow

Proceed with creating Prompt flow flows as usual. See this [example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-promptflow/examples/chat_flow_example_to_phoenix.ipynb) for inspiration.

## Observe

You should see the spans render in Phoenix as shown in the below screenshots.

<figure><img src="../../.gitbook/assets/Chat flow example 2.png" alt=""><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/Chat flow example 1.png" alt=""><figcaption></figcaption></figure>

## Resources

* [Example Notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-promptflow/examples/chat_flow_example_to_phoenix.ipynb)
