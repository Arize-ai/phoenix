---
description: >-
  The easiest way to run Phoenix is locally in your own computer. To launch
  Phoenix, use the following steps.
---

# Quickstart

## Install

{% tabs %}
{% tab title="Using pip" %}
```bash
pip install arize-phoenix
```
{% endtab %}

{% tab title="Using conda" %}
```bash
conda install -c conda-forge arize-phoenix
```
{% endtab %}

{% tab title="Docker" %}
Phoenix server images are available via [Docker Hub](https://hub.docker.com/r/arizephoenix/phoenix) and can be used via [docker compose ](deployment/docker.md)or if you simply want a long-running phoenix instance to share with your team.

```bash
docker pull arizephoenix/phoenix:latest
```
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
If you don't want to host an instance of Phoenix yourself or use a notebook instance, you can use a persistent instance provided on our site. Sign up for an Arize Phoenix account at [https://app.phoenix.arize.com/login](https://app.phoenix.arize.com/login)

For more details, see [hosted-phoenix.md](hosted-phoenix.md "mention")
{% endtab %}
{% endtabs %}

## Launch Phoenix

Launching phoenix can be done in many ways depending on your use-case.

{% tabs %}
{% tab title="Command Line" %}
Launch your local Phoenix instance using:

```bash
python3 -m phoenix.server.main serve
```

For details on customizing a local terminal deployment, see [Terminal Setup](https://docs.arize.com/phoenix/setup/environments#terminal).
{% endtab %}

{% tab title="Docker" %}
Launch your loaded docker image using:

```bash
docker run -p 6006:6006 arizephoenix/phoenix:latest
```

This will expose the Phoenix on `localhost:6006`

For more details on customizing a docker deployment, see [#docker](quickstart.md#docker "mention")
{% endtab %}

{% tab title="Notebook" %}
Within your notebook, launch Phoenix using:

```python
import phoenix as px
px.launch_app()
```

{% hint style="info" %}
By default, notebook instances do not have persistent storage, so your traces will disappear after the notebook is closed. See [persistence.md](deployment/persistence.md "mention") or use one of the other deployment options to retain traces.
{% endhint %}
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
Hosted Phoenix instances are always online. Nothing more to do here!
{% endtab %}
{% endtabs %}

## Connect your App

To collect traces from your application, you must point your app to your Phoenix instance.

{% tabs %}
{% tab title="Local Instance / Docker (Python)" %}
Install packages:

```bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp
```

Connect your application to your instance using:

```python
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

tracer_provider = trace_sdk.TracerProvider()
span_exporter = OTLPSpanExporter("http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

See [deploying-phoenix.md](deployment/deploying-phoenix.md "mention") for more details
{% endtab %}

{% tab title="Notebook" %}
Connect your notebook to Phoenix:

```python
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

tracer_provider = trace_sdk.TracerProvider()
span_exporter = OTLPSpanExporter("http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```
{% endtab %}

{% tab title="app.phoenix.arize.com" %}
Install the following dependencies:

```bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp
```

Connect your application to your cloud instance using:

```python
import os
from opentelemetry import trace as trace_api
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import (
    OTLPSpanExporter as GRPCSpanExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter as HTTPSpanExporter,
)

# Add Phoenix API Key for tracing
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"api_key={PHOENIX_API_KEY}"

# Add Phoenix
span_phoenix_processor = SimpleSpanProcessor(HTTPSpanExporter(endpoint="https://app.phoenix.arize.com/v1/traces"))

# Add them to the tracer
tracer_provider = trace_sdk.TracerProvider()
tracer_provider.add_span_processor(span_processor=span_phoenix_processor)
trace_api.set_tracer_provider(tracer_provider=tracer_provider)
```

Your Phoenix API key can be found on the Keys section of your dashboard.
{% endtab %}
{% endtabs %}

## Next Steps

* [Trace](tracing/quckstart-tracing.md) a running application
* Run [evaluations](quickstart/evals.md) on traces
* Test changes to you prompts, models, and application via [experiments](datasets-and-experiments/how-to-experiments/run-experiments.md)
