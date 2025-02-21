---
description: Create flows using Microsoft PromptFlow and send their traces to Phoenix
---

# Prompt flow

This integration will allow you to trace [Microsoft PromptFlow](https://github.com/microsoft/promptflow) flows and send their traces into[`arize-phoenix`](https://github.com/Arize-ai/phoenix).

## Launch Phoenix

{% tabs %}
{% tab title="Phoenix Developer Edition" %}
**Sign up for Phoenix:**

Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your cloud instance:**

```python
import os
from phoenix.otel import register

# Add Phoenix API Key for tracing
PHOENIX_API_KEY = "ADD YOUR API KEY"
os.environ["PHOENIX_CLIENT_HEADERS"] = f"api_key={PHOENIX_API_KEY}"
os.environ["PHOENIX_COLLECTOR_ENDPOINT"] = "https://app.phoenix.arize.com"

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
) 
```

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
pip install arize-phoenix
phoenix serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your instance using:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:6006/v1/traces",
)
```

See [deploying-phoenix.md](../../deployment/deploying-phoenix.md "mention") for more details
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

**Connect your application to your instance using:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="http://localhost:6006/v1/traces",
)
```

For more info on using Phoenix with Docker, see [#docker](prompt-flow.md#docker "mention")
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

**Connect your notebook to Phoenix:**

```python
from phoenix.otel import register

tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
)
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [persistence.md](../../deployment/persistence.md "mention") or use one of the other deployment options to retain traces.
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

endpoint = f"http://127.0.0.1:6006/v1/traces" # replace with your Phoenix endpoint if self-hosting
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
