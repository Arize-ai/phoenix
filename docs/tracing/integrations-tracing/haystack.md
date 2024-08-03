---
description: Instrument LLM applications built with Haystack
---

# Haystack

Phoenix provides auto-instrumentation for [Haystack](https://haystack.deepset.ai/)

## Install

```bash
pip install openinference-instrumentation-haystack haystack-ai
```

## Setup

Set up [OpenTelemetry to point to a running Phoenix instance](https://docs.arize.com/phoenix/quickstart) and then initialize the HaystackInstrumentor before your application code.

```python
from openinference.instrumentation.haystack import HaystackInstrumentor

HaystackInstrumentor().instrument()
```

## Run Haystack

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

* [Example notebook](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-haystack/examples/qa\_rag\_pipeline.py)
* [OpenInference package](https://github.com/Arize-ai/openinference/blob/main/python/instrumentation/openinference-instrumentation-haystack)
* [Working examples](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-haystack/examples)
