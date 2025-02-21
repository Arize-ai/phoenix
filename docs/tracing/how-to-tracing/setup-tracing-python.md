---
description: How to configure OpenTelemetry and connect to the Phoenix server
---

# Setup Tracing: Python

Phoenix uses OTLP (OpenTelemetry Language Protocol) to receive traces from your phoenix instance. To make this process as simple as possible, we've created a python package called `arize-phoenix-otel` for python.

{% hint style="info" %}
Note that you do not need to use arize-phoenix-otel to setup OpenTelemetry. If you wold like to use pure OpenTelemetry, see [custom-spans.md](custom-spans.md "mention")
{% endhint %}

Install the **arize-phoenix-otel** python package. This may be already installed.

```bash
pip install arize-phoenix-otel
```

If you have specified endpoints, headers, and project names as [environment variables](../../deployment/configuration.md#environment-variables), setting up OTEL can be as simple as:

<pre class="language-python"><code class="lang-python"><strong>from phoenix.otel import register
</strong>
<strong># Configuration is picked up from your environment variables
</strong>tracer_provider = register()

# Initialize Instrumentors and pass in the tracer_provider
# E.x. OpenAIInstrumentor.instrument(tracer_provider=tracer_provider)
</code></pre>

{% hint style="success" %}
And setup is done! Next you'll need to either:

* Setup [integrations](../integrations-tracing/) to capture traces automatically, and/or
* Add [instrumentation](instrument-python.md) to manually define the traces you want captured



Read further in this guide for more advanced Phoenix configuration options.
{% endhint %}

## Setup Endpoints, Projects, etc.

Register by default picks up your configuration from [environment variables](../../deployment/configuration.md#environment-variables) but you can configure it using arguments as well:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="my-llm-app",
    endpoint="http:/localhost:4317"  # or http at "http://localhost:6006/v1/traces"
    headers={"authorization": "<your-api-key>"}, 
    # NOTE: For app.phoenix.arize.com, set the api key in the
    # headers via "api_key" instead of "authorization", i.e.
    # headers={"api_key": "<your-api-key>"}, 
)
```

When using the `endpoint` argument, we must pass in the fully qualified OTel endpoint. Phoenix provides two endpoits:

* **gRPC**: more performant
  * by default exposed on port **4317**: `<PHOENIX_HOST>:4317`
* **HTTP**: simpler
  * by default exposed on port **6006 and /v1/traces**: `<PHOENIX_HOST>:6006/v1/traces`

When passing in an `endpoint`directly, the transport protocol (`http`or `gRPC` ) will be inferred from the endpoint. However, when using a custom endpoint, the protocol can be enforced by passing in a `protocol`argument, specifying either: `http/protobuf`or `grpc`.

**phoenix.otel** can be further configured for things like batch span processing and specifying resources. For the full details of how to configure **phoenix.otel,** please consult the package repository ([https://github.com/Arize-ai/phoenix/tree/main/packages/phoenix-otel](https://github.com/Arize-ai/phoenix/tree/main/packages/phoenix-otel))

## Log to a specific project

Phoenix uses projects to group traces. If left unspecified, all traces are sent to a default project.

{% embed url="https://www.youtube.com/watch?v=GPno92s9WFM" %}

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

## How to turn off tracing

Tracing can be paused temporarily or disabled permanently.

### Pause tracing using context manager

If there is a section of your code for which tracing is not desired, e.g. the document chunking process, it can be put inside the `suppress_tracing` context manager as shown below.

```python
from phoenix.trace import suppress_tracing

with suppress_tracing():
    # Code running inside this block doesn't generate traces.
    # For example, running LLM evals here won't generate additional traces.
    ...
# Tracing will resume outside the block.
...
```

### Uninstrument the auto-instrumentors permanently

Calling `.uninstrument()` on the auto-instrumentors will remove tracing permanently. Below is the examples for LangChain, LlamaIndex and OpenAI, respectively.

```python
LangChainInstrumentor().uninstrument()
LlamaIndexInstrumentor().uninstrument()
OpenAIInstrumentor().uninstrument()
# etc.
```
