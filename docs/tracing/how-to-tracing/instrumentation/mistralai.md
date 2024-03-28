---
description: Instrument LLM calls made using MistralAI's SDK
---

# MistralAI

MistralAI is a leading provider for state-of-the-art LLMs. The MistralAI SDK can be instrumented using the [`openinference-instrumentation-mistralai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-mistralai) package.

### Installation

```
pip install mistralai
```

### Quickstart

In this example we will instrument a small program that uses the MistralAI chat completions API and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```
pip install openinference-instrumentation-mistralai mistralai arize-phoenix opentelemetry-sdk opentelemetry-exporter-otlp
```

Set the `MISTRAL_API_KEY` environment variable to authenticate calls made using the SDK.

```
export MISTRAL_API_KEY=[your_key_here]
```

Start a Phoenix server to collect traces.

```
python -m phoenix.server.main serve
```

In a python file, setup the `MistralAIInstrumentor` and configure the tracer to send traces to Phoenix.

```python
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage
from openinference.instrumentation.mistralai import MistralAIInstrumentor
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

MistralAIInstrumentor().instrument()


if __name__ == "__main__":
    client = MistralClient()
    response = client.chat(
        model="mistral-large-latest",
        messages=[
            ChatMessage(
                content="Who won the World Cup in 2018?",
                role="user",
            )
        ],
    )
    print(response.choices[0].message.content)

```

Run the python file and observe the traces in Phoenix.

```
python your_file.py
```
