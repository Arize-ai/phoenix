---
description: How to configure OpenTelemetry and connect to the Phoenix server
---

# Setup Tracing: Python

Phoenix uses OTLP (OpenTelemetry Language Protocol) to receive traces from your phoenix instance. To make this process as simple as possible, we've created a python package called `arize-phoenix-otel` for python.&#x20;

{% hint style="info" %}
Note that you do not need to use arize-phoenix-otel to setup OpenTelemetry. If you wold like to use pure OpenTelemetry, see [using-otel-python-directly.md](using-otel-python-directly.md "mention")
{% endhint %}

Install the **arize-phoenix-otel** python package. This may be already installed.

```bash
pip install arize-phoenix-otel
```

If you have specified endpoints, headers, and project names as [environment variables](../../../../setup/configuration.md#environment-variables), setting up OTEL can be as simple as:

<pre class="language-python"><code class="lang-python"><strong>from phoenix.otel import register
</strong><strong>
</strong><strong># Configuration is picked up from your environment variables
</strong>tracer_provider = register()

# Initialize Instrumentors and pass in the tracer_provider
# E.x. OpenAIInstrumentor.instrument(tracer_provider=tracer_provider)
</code></pre>

And setup is done! You are ready to setup [integrations](../../../integrations-tracing/) and instrumentation.  Read further for more advanced configuration options.

## Setup Endpoints, Projects, etc.

Register by default picks up your configuration from [environment variables](../../../../setup/configuration.md#environment-variables) but you can configure it using arguments as well:

```python
from phoenix.otel import register

tracer_provider = register(
    project_name="my-llm-app",
    endpoint="http:/localhost:4317"  # or http at "http://localhost:6006/v1/traces"
    headers={"api_key": "<your-api-key>"}, # E.x. credentials for app.phoenix.arize.com
)
```

When using the `endpoint` argument, we must pass in the fully qualified OTel endpoint. Phoenix provides two endpoits:

* **gRPC**: more performant
  * by default exposed on port **4317**: `<PHOENIX_HOST>:4317`
* **HTTP**: simpler
  * by default exposed on port **6006 and /v1/traces**: `<PHOENIX_HOST>:6006/v1/traces`

**phoenix.otel** can be further configured for things like batch span processing and specifying resources. For the full details of how to configure **phoenix.otel,** please consult the package repository ([https://github.com/Arize-ai/phoenix/tree/main/packages/phoenix-otel](https://github.com/Arize-ai/phoenix/tree/main/packages/phoenix-otel))



