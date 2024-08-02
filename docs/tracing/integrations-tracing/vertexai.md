---
description: Instrument LLM calls made using VertexAI's SDK via the VertexAIInstrumentor
---

# VertexAI

The VertexAI SDK can be instrumented using the [`openinference-instrumentation-vertexai`](https://github.com/Arize-ai/openinference/tree/main/python/instrumentation/openinference-instrumentation-vertexai) package.

### Installation

```shell
pip install openinference-instrumentation-vertexai
```

### Quickstart

In this example we will instrument a small program that uses VertexAI and observe the traces via [`arize-phoenix`](https://github.com/Arize-ai/phoenix).

```shell
pip install -U \
    vertexai \
    openinference-instrumentation-vertexai \
    arize-phoenix \
    opentelemetry-sdk \
    opentelemetry-exporter-otlp \
    "opentelemetry-proto>=1.12.0"
```

Start a Phoenix server in the background to collect traces. Phoenix runs locally and does not send data over the internet.

```shell
python -m phoenix.server.main serve
```

See Google's [guide](https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal#expandable-1) on setting up your environment for the Google Cloud AI Platform.

You can also store your Project ID in the `CLOUD_ML_PROJECT_ID` environment variable.

In a Python file, set up the `VertexAIInstrumentor` and configure the tracer to send traces to Phoenix.

```python
import vertexai
from openinference.instrumentation.vertexai import VertexAIInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor
from vertexai.generative_models import GenerativeModel

endpoint = "http://127.0.0.1:4317"
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
# Optionally, you can also print the spans to the console.
tracer_provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

VertexAIInstrumentor().instrument(tracer_provider=tracer_provider)

vertexai.init(location="us-central1")
model = GenerativeModel("gemini-1.5-flash")

print(model.generate_content("Why is sky blue?").text)
```

Run the python file and observe the traces in Phoenix.

```shell
python your_file.py
```
