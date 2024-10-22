---
description: Instrument LLM calls made using VertexAI's SDK via the VertexAIInstrumentor
---

# VertexAI

The VertexAI SDK can be instrumented using the [`openinference-instrumentation-vertexai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai) package.

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

For more info on using Phoenix with Docker, see [#docker](vertexai.md#docker "mention")
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If you don't want to host an instance of Phoenix yourself or use a notebook instance, you can use a persistent instance provided on our site. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

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

```shell
pip install openinference-instrumentation-vertexai vertexai
```

## Setup

See Google's [guide](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal#expandable-1) on setting up your environment for the Google Cloud AI Platform. You can also store your Project ID in the `CLOUD_ML_PROJECT_ID` environment variable.

Initialize the VertexAIInstrumentor before your application code.

```python
from openinference.instrumentation.vertexai import VertexAIInstrumentor

VertexAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

## Run VertexAI

```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(location="us-central1")
model = GenerativeModel("gemini-1.5-flash")

print(model.generate_content("Why is sky blue?").text)
```

## Observe

Now that you have tracing setup, all invocations of Vertex models will be streamed to your running Phoenix for observability and evaluation.

## Resources

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai/examples/basic\_generation.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai/examples)
