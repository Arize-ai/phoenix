---
description: Instrument LLM calls made using MistralAI's SDK via the MistralAIInstrumentor
---

# MistralAI

MistralAI is a leading provider for state-of-the-art LLMs. The MistralAI SDK can be instrumented using the [`openinference-instrumentation-mistralai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai) package.

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

For more info on using Phoenix with Docker, see [#docker](mistralai.md#docker "mention")
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
pip install openinference-instrumentation-mistralai mistralai
```

## Setup

Set the `MISTRAL_API_KEY` environment variable to authenticate calls made using the SDK.

```
export MISTRAL_API_KEY=[your_key_here]
```

Initialize the MistralAIInstrumentor before your application code.

```python
from openinference.instrumentation.mistralai import MistralAIInstrumentor

MistralAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run Mistral

```python
import os

from mistralai import Mistral
from mistralai.models import UserMessage

api_key = os.environ["MISTRAL_API_KEY"]
model = "mistral-tiny"

client = Mistral(api_key=api_key)

chat_response = client.chat.complete(
    model=model,
    messages=[UserMessage(content="What is the best French cheese?")],
)
print(chat_response.choices[0].message.content)

```

## Observe

Now that you have tracing setup, all invocations of Mistral (completions, chat completions, embeddings) will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai/examples/chat\_completions.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-mistralai/examples)
