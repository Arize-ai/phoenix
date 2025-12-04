---
description: Instrument LLM calls made using VertexAI's SDK via the VertexAIInstrumentor
---

# VertexAI Tracing

The VertexAI SDK can be instrumented using the [`openinference-instrumentation-vertexai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai) package.

## Launch Phoenix

## Install

```shell
pip install openinference-instrumentation-vertexai vertexai
```

## Setup

See Google's [guide](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal#expandable-1) on setting up your environment for the Google Cloud AI Platform. You can also store your Project ID in the `CLOUD_ML_PROJECT_ID` environment variable.

Use the register function to connect your application to Phoenix:

```python
from phoenix.otel import register

# configure the Phoenix tracer
tracer_provider = register(
  project_name="my-llm-app", # Default is 'default'
  auto_instrument=True # Auto-instrument your app based on installed OI dependencies
)
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

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai/examples/basic_generation.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai)
* [Working examples](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-vertexai/examples)
