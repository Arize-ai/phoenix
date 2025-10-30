---
description: Instrument LLM applications built with Haystack
---

# Haystack Tracing

{% embed url="https://www.youtube.com/watch?t=6s&v=ZbOs_Njx2ko" %}

Phoenix provides auto-instrumentation for [Haystack](https://haystack.deepset.ai/)

## Launch Phoenix

{% include "../../../../phoenix-integrations/.gitbook/includes/sign-up-for-phoenix-sign-up....md" %}

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

If you don't want to use Haystack pipelines but still want tracing in Phoenix, you can use instead of this auto-instrumentor.
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
