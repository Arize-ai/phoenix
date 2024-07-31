---
description: Instrument LLM applications built with Haystack
---

# Haystack

### Quickstart

In this example we will instrument a small program that uses the MistralAI chat completions API and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```
pip install openinference-instrumentation-haystack haystack arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp
```

Start a Phoenix server to collect traces.

```
python -m phoenix.server.main serve
```

In a python file, setup the `HaystackInstrumentor` and configure the tracer to send traces to Phoenix.

```python
from openinference.instrumentation.haystack import HaystackInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
# Optionally, you can also print the spans to the console.
tracer_provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace_api.set_tracer_provider(tracer_provider)

HaystackInstrumentor().instrument()


if __name__ == "__main__":
    from haystack import Pipeline
    from haystack.components.generators import OpenAIGenerator
    
    # Initialize the pipeline
    pipeline = Pipeline()
    
    # Initialize the OpenAI generator component
    llm = OpenAIGenerator(model="gpt-3.5-turbo")
    
    # Add the generator component to the pipeline
    pipeline.add_component("llm", llm)
    
    # Define the question
    question = "What is the location of the Hanging Gardens of Babylon?"
    
    # Run the pipeline with the question
    response = pipeline.run({"llm": {"prompt": question}})
    
    print(response)

```

Run the python file and observe the traces in Phoenix.

```
python your_file.py
```
