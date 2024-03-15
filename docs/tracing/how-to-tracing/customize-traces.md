---
description: Oftentimes you want to customize various aspects of traces you log to Phoenix
---

# Customize Traces

## Log to a specific project

Phoenix uses [projects](../concepts-tracing.md#projects) to group traces. If left unspecified, all traces are sent to a default project.&#x20;

{% tabs %}
{% tab title="Phoenix" %}
In the notebook, you can set the `PHOENIX_PROJECT_NAME` environment variable **before** adding instrumentation or running any of your code.

In python this would look like:

```python
import os

os.environ['PHOENIX_PROJECT_NAME'] = "<your-project-name>"
```
{% endtab %}

{% tab title="OpenInference" %}
If you are using Phoenix as a collector and running your application separately, you can set the project name in the `Resource` attributes for the trace provider.&#x20;

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
span_exporter = OTLPSpanExporter(endpoint="http://phoenix:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor=span_processor)
trace_api.set_tracer_provider(tracer_provider=tracer_provider)
# Add any auto-instrumentation you want 
LlamaIndexInstrumentor().instrument()
```
{% endtab %}
{% endtabs %}

## Switching projects in a notebook

While working with Phoenix inside a notebook, we provide a utility to temporarily associate spans with different projects.

{% tabs %}
{% tab title="Notebook" %}
```python
from phoenix.trace import using_project

with using_project("override"):
    # all spans created within this context will be associated with
    # the "override" project.
```
{% endtab %}
{% endtabs %}
