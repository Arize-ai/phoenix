---
description: Instrument LLM applications built with Haystack
---

# Haystack

### Quickstart

In this example we will instrument a small program that uses [Haystack](https://haystack.deepset.ai/) to make calls to GPT 3.5 turbo, and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```
pip install openinference-instrumentation-haystack haystack-ai arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp
```

In a python file, setup the `HaystackInstrumentor` and configure the tracer to send traces to Phoenix.

```python
from openinference.instrumentation.haystack import HaystackInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
import phoenix as px

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
trace_api.set_tracer_provider(tracer_provider)

px.launch_app()
HaystackInstrumentor().instrument()

```

From there, you can set up your Haystack app as normal:

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
