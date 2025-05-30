---
description: Instrument LLM applications built with Haystack
---

# Haystack Tracing

{% embed url="https://www.youtube.com/watch?t=6s&v=ZbOs_Njx2ko" %}

Phoenix provides auto-instrumentation for [Haystack](https://haystack.deepset.ai/)

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

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).

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

For more info on using Phoenix with Docker, see [Docker](https://docs.arize.com/phoenix/self-hosting/deployment-options/docker).
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
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [self-hosting](https://docs.arize.com/phoenix/self-hosting) or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}
{% endtabs %}

## Install

```bash
pip install openinference-instrumentation-haystack haystack-ai
```

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

## Run Haystack

{% hint style="info" %}
Phoenix's auto-instrumentor collects any traces from **Haystack Pipelines**. If you are using Haystack but not using Pipelines, you won't see traces appearing in Phoenix automatically.

If you don't want to use Haystack pipelines but still want tracing in Phoenix, you can use  instead of this auto-instrumentor.
{% endhint %}

From here, you can set up your Haystack app as normal:

```python
from haystack import Pipeline
from haystack.components.generators import OpenAIGenerator
from haystack.components.builders.prompt_builder import PromptBuilder

prompt_template = """
Answer the following question.
Question: {{question}}
Answer:
"""

# Initialize the pipeline
pipeline = Pipeline()

# Initialize the OpenAI generator component
llm = OpenAIGenerator(model="gpt-3.5-turbo")
prompt_builder = PromptBuilder(template=prompt_template)

# Add the generator component to the pipeline
pipeline.add_component("prompt_builder", prompt_builder)
pipeline.add_component("llm", llm)
pipeline.connect("prompt_builder", "llm")

# Define the question
question = "What is the location of the Hanging Gardens of Babylon?"
```

## Observe

Now that you have tracing setup, all invocations of pipelines will be streamed to your running Phoenix for observability and evaluation.

## Resources:

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-haystack/examples/qa_rag_pipeline.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-haystack)
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-haystack/examples)
