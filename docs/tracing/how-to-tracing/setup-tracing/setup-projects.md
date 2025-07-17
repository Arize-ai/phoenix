# Setup Projects

## Log to a specific project

Phoenix uses projects to group traces. If left unspecified, all traces are sent to a default project.

{% tabs %}
{% tab title="Using Phoenix Wrappers" %}
In the notebook, you can set the `PHOENIX_PROJECT_NAME` environment variable **before** adding instrumentation or running any of your code.

In python this would look like:

```python
import os

os.environ['PHOENIX_PROJECT_NAME'] = "<your-project-name>"
```

{% hint style="warning" %}
Note that setting a project via an environment variable only works in a notebook and must be done **BEFORE** instrumentation is initialized. If you are using OpenInference Instrumentation, see the Server tab for how to set the project name in the Resource attributes.
{% endhint %}

Alternatively, you can set the project name in your `register` function call:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="my-project-name",
    ....
)
```
{% endtab %}

{% tab title="Using OTEL Directly" %}
If you are using Phoenix as a collector and running your application separately, you can set the project name in the `Resource` attributes for the trace provider.

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

Projects work by setting something called the **Resource** attributes (as seen in the OTEL example above). The phoenix server uses the project name attribute to group traces into the appropriate project.

## Switching projects in a notebook

Typically you want traces for an LLM app to all be grouped in one project. However, while working with Phoenix inside a notebook, we provide a utility to temporarily associate spans with different projects. You can use this to trace things like evaluations.

{% tabs %}
{% tab title="Notebook" %}
```python
from phoenix.trace import using_project

# Switch project to run evals
with using_project("my-eval-project"):
    # all spans created within this context will be associated with
    # the "my-eval-project" project.
    # Run evaluations here...
```
{% endtab %}
{% endtabs %}
