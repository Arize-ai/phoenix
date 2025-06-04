---
hidden: true
---

# LangGraph

Phoenix has first-class support for [LangGraph](https://www.langchain.com/langgraph) applications.

{% hint style="info" %}
LangGraph is supported by our [LangChain instrumentor](langchain.md). If you've already set up instrumentation with LangChain, you don't need to complete the set up below
{% endhint %}

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
pip install openinference-instrumentation-langchain
```

Install the OpenInference Langchain library before your application code. Our LangChainInstrumentor works for both standard LangChain applications and for LangGraph agents.

## Setup

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run LangGraph

By instrumenting LangGraph, spans will be created whenever an agent is invoked and will be sent to the Phoenix server for collection.

## Observe

Now that you have tracing setup, all invocations of chains will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/langgraph_agent_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-langchain)
* [Blog walkthrough](https://arize.com/blog/langgraph/)
