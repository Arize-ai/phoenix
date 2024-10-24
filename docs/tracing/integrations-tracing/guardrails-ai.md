---
description: Instrument LLM applications that use the Guardrails AI framework
---

# Guardrails AI

{% embed url="https://www.youtube.com/watch?v=o5bo9P3WW7k" %}

In this example we will instrument a small program that uses the [Guardrails AI](https://www.guardrailsai.com/) framework to protect their LLM calls.

## Launch Phoenix

{% tabs %}
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

{% tab title="Command Line" %}
**Launch your local Phoenix instance:**

```bash
python3 -m phoenix.server.main serve
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

For more info on using Phoenix with Docker, see [#docker](guardrails-ai.md#docker "mention")
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If you don't want to host an instance of Phoenix yourself or use a notebook instance, you can use a persistent instance provided on our site. Sign up for an Arize Phoenix account at[https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

**Install packages:**

```bash
pip install arize-phoenix-otel
```

**Connect your application to your cloud instance:**

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

Your **Phoenix API key** can be found on the Keys section of your [dashboard](https://app.phoenix.arize.com).
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-guardrails guardrails-ai
```

## Setup

Initialize the GuardrailsAIInstrumentor before your application code.

```python
from openinference.instrumentation.guardrails import GuardrailsInstrumentor

GuardrailsInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run Guardrails

From here, you can run Guardrails as normal:

```python
from guardrails import Guard
from guardrails.hub import TwoWords
import openai

guard = Guard().use(
    TwoWords(),
)
response = guard(
    llm_api=openai.chat.completions.create,
    prompt="What is another name for America?",
    model="gpt-3.5-turbo",
    max_tokens=1024,
)

print(response)

```

## Observe

Now that you have tracing setup, all invocations of underlying models used by Guardrails (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation. Additionally, Guards will be present as a new span kind in Phoenix.

## Resources

* [Example notebook](https://github.com/Arize-ai/dataset-embeddings-guardrails/blob/main/validator/arize\_demo\_dataset\_embeddings\_guard.ipynb)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-guardrails)
