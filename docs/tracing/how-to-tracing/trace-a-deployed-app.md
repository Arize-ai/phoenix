---
description: >-
  Once you are done iterating in a notebook, you can get the same observability
  in production
---

# Trace a Deployed App

<figure><img src="https://storage.googleapis.com/arize-assets/phoenix/assets/images/migrate_from_notebook.png" alt=""><figcaption><p>You can bring the same observability to a running application</p></figcaption></figure>

## How to Instrument an Application

The same tracing capabilities you used during your experimentation in the notebook is available when you deploy your application. As illustrated in the image above, Phoenix is made up of  **tracing** capabilities as well as **collecting** capabilities. Notably,`phoenix.trace` is in fact a wrapper around  [OpenInference auto-instrumentation](https://github.com/Arize-ai/openinference) and the OpenTelemetry SDK.  When you deploy your application, you only need to bring along the **instrumentation** parts. \
\
Let's take the following code in the notebook and look at how this might look on the server.\
\
**BEFORE**

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

\
**AFTER**

```python
from openinference.semconv.resource import ResourceAttributes
from openinference.instrumentation.llama_index import LlamaIndexInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

resource = Resource(attributes={
    ResourceAttributes.PROJECT_NAME: '<your-project-name>'
})
tracer_provider = trace_sdk.TracerProvider(resource=resource)
# If you deploy phoenix via compose, your endpoint will look something like below
span_exporter = OTLPSpanExporter(endpoint="http://phoenix:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor=span_processor)
trace_api.set_tracer_provider(tracer_provider=tracer_provider)

OpenAIInstrumentor().instrument()
```

Note that you **DO NOT** need to install Phoenix to collect traces. All you need is OpenInference instrumentation and OpenTelemetry. The dependancies would look like:

```bash
pip install openinference-instrumentation-openai openinference-semantic-conventions opentelemetry-sdk opentelemetry-exporter-otlp

```

{% hint style="warning" %}
Note that instrumentation **MUST** be initialized **BEFORE** you use initialize any library or package that you are instrumenting.
{% endhint %}

Once you've made the appropriate instrumentation, you can [deploy phoenix](../../deployment/deploying-phoenix.md) and  the traces will be exported to the phoenix server (collector).\
\
For fully working Python examples, [check out our example apps](https://github.com/Arize-ai/openinference/tree/main/python/examples)

## Exporting Traces to Arize

Arize is an enterprise grade observability platform that supports the same capabilities as Phoenix. Note that you can export your traces to both Phoenix and Arize if you so desire (simply add two **exporters**).  See the [Arize documentation](https://docs.arize.com/arize/llm-large-language-models/llm-traces) for details.
