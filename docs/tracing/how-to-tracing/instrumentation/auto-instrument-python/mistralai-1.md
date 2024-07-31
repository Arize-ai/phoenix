---
description: Instrument LLM applications that use the Guardrails AI framework
---

# Guardrails AI

In this example we will instrument a small program that uses the Guardrails AI framework to protect their LLM calls.

### Quickstart

In this example we will instrument a small program that uses the MistralAI chat completions API and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```
pip install openinference-instrumentation-guardrails openinference-instrumentation-guardrails guardrails-ai arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp
```

Start a Phoenix server to collect traces.

```
python -m phoenix.server.main serve
```

In a python file, setup the `GuardrailsAIInstrumentor` and configure the tracer to send traces to Phoenix.

```python
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from openinference.instrumentation.guardrails import GuardrailsInstrumentor
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

GuardrailsInstrumentor().instrument()


if __name__ == "__main__":
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

Run the python file and observe the traces in Phoenix.

```
python your_file.py
```
