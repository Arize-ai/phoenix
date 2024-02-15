---
description: Instrument and observe your DSPy application
---

# DSPy

[DSPy](https://github.com/stanfordnlp/dspy) is a framework for automatically prompting and fine-tuning language models. It provides composable and declarative APIs that allow developers to describe the architecture of their LLM application in the form of a "module" (inspired by PyTorch's `nn.Module`). It them compiles these modules using "teleprompters" that optimize the module for a particular task. The term "teleprompter" is meant to evoke "prompting at a distance," and could involve selecting few-shot examples, generating prompts, or fine-tuning language models.

Phoenix makes your DSPy applications observable by visualizing the underlying structure of each call to your compiled DSPy module.

## Tracing

To trace your DSPy application, ensure that the following packages are installed in addition to DSPy:

```
pip install arize-phoenix openinference-instrumentation-dspy opentelemetry-exporter-otlp
```

Launch Phoenix as a collector in the background.

```python
import phoenix as px

px.launch_app()
```

Configure your OpenTelemetry exporter, which will export spans and traces to Phoenix, and run the DSPy instrumentor to wrap calls to the relevant DSPy components.

```python
from openinference.instrumentation.dspy import DSPyInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

endpoint = "http://127.0.0.1:6006/v1/traces"
resource = Resource(attributes={})
tracer_provider = trace_sdk.TracerProvider(resource=resource)
span_otlp_exporter = OTLPSpanExporter(endpoint=endpoint)
tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter=span_otlp_exporter))
trace_api.set_tracer_provider(tracer_provider=tracer_provider)
DSPyInstrumentor().instrument()
```

Now run invoke your compiled DSPy module. Your traces should appear inside of Phoenix.

![Traces and spans from an instrumented DSPy custom module.](https://storage.googleapis.com/arize-phoenix-assets/assets/docs/notebooks/dspy-tracing-tutorial/dspy\_spans\_and\_traces.gif)

For a full working example, check out the [Colab](https://colab.research.google.com/github/Arize-ai/phoenix/blob/main/tutorials/tracing/dspy\_tracing\_tutorial.ipynb).
