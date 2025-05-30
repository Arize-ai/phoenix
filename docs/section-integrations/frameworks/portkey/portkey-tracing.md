---
description: >-
  How to trace Portkey AI Gateway requests with Phoenix for comprehensive LLM
  observability
---

# Portkey Tracing

Phoenix provides seamless integration with [Portkey](https://portkey.ai/), the AI Gateway and observability platform that routes to 200+ LLMs with enterprise-grade features including guardrails, caching, and load balancing.

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

See Terminal for more details
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
pip install openinference-instrumentation-portkey portkey-ai
```

## Setup

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-portkey-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
```

## Run Portkey

By instrumenting Portkey, spans will be created whenever requests are made through the AI Gateway and will be sent to the Phoenix server for collection.

### Basic Usage with OpenAI

```python
import os
from openai import OpenAI
from portkey_ai import PORTKEY_GATEWAY_URL, createHeaders

# Set up your API keys
os.environ["OPENAI_API_KEY"] = "your-openai-api-key"
os.environ["PORTKEY_API_KEY"] = "your-portkey-api-key"  # Optional for self-hosted

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    base_url=PORTKEY_GATEWAY_URL,
    default_headers=createHeaders(
        provider="openai",
        api_key=os.environ.get("PORTKEY_API_KEY")
    )
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is artificial intelligence?"}]
)

print(response.choices[0].message.content)
```

### Using Portkey SDK Directly

```python
from portkey_ai import Portkey

# Initialize Portkey client
portkey = Portkey(
    api_key="your-portkey-api-key",  # Optional for self-hosted
    virtual_key="your-openai-virtual-key"  # Or use provider-specific virtual keys
)

response = portkey.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Explain machine learning"}]
)

print(response.choices[0].message.content)
```

## Observe

Now that you have tracing setup, all requests through Portkey's AI Gateway will be streamed to your running Phoenix instance for observability and evaluation. You'll be able to see:

* **Request/Response Traces**: Complete visibility into LLM interactions
* **Routing Decisions**: Which provider was selected and why
* **Fallback Events**: When and why fallbacks were triggered
* **Cache Performance**: Hit/miss rates and response times
* **Cost Tracking**: Token usage and costs across providers
* **Latency Metrics**: Response times for each provider and route

## Resources

* [Phoenix OpenInference Instrumentation](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-portkey)
