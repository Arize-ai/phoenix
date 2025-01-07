---
description: >-
  How to use the python OpenAIInstrumentor to trace OpenAI LLM and embedding
  calls
---

# OpenAI

Note: This instrumentation also works with Azure OpenAI

Phoenix provides auto-instrumentation for the [OpenAI Python Library](https://github.com/openai/openai-python).

## Launch Phoenix

We have several code samples below on different ways to integrate with OpenAI, based on how you want to use Phoenix.

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

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  endpoint="https://app.phoenix.arize.com/v1/traces",
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

For more info on using Phoenix with Docker, see [#docker](openai.md#docker "mention")
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
pip install openinference-instrumentation-openai openai 'httpx<0.28'
```

## Setup

Add your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=[your_key_here]
```

Initialize the OpenAIInstrumentor before your application code:

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run OpenAI

```python
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Write a haiku."}],
)
print(response.choices[0].message.content)
```

## Observe

Now that you have tracing setup, all invocations of OpenAI (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/phoenix/blob/main/tutorials/tracing/openai_tracing_tutorial.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai)
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-openai/examples)
