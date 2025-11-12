# Setup using Phoenix OTEL

`phoenix.otel` is a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults.

```bash
pip install arize-phoenix-otel
```

These defaults are aware of environment variables you may have set to configure Phoenix:

* `PHOENIX_COLLECTOR_ENDPOINT`
* `PHOENIX_PROJECT_NAME`
* `PHOENIX_CLIENT_HEADERS`
* `PHOENIX_API_KEY`
* `PHOENIX_GRPC_PORT`

## Quickstart: `phoenix.otel.register`

The `phoenix.otel` module provides a high-level `register` function to configure OpenTelemetry tracing by setting a global `TracerProvider`. The register function can also configure headers and whether or not to process spans one by one or by batch.

```python
from phoenix.otel import register
tracer_provider = register(
    project_name="default", # sets a project name for spans
    batch=True, # uses a batch span processor
    auto_instrument=True, # uses all installed OpenInference instrumentors
)
```

### Phoenix Authentication

If the `PHOENIX_API_KEY` environment variable is set, `register` will automatically add an `authorization` header to each span payload.

### Configuring the collector endpoint

There are two ways to configure the collector endpoint:

* Using environment variables
* Using the `endpoint` keyword argument

#### Using environment variables

If you're setting the `PHOENIX_COLLECTOR_ENDPOINT` environment variable, `register` will\
automatically try to send spans to your Phoenix server using gRPC.

{% tabs %}
{% tab title="GRPC" %}
```python
# export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.com:6006

from phoenix.otel import register

# sends traces to https://your-phoenix.com:4317
tracer_provider = register()
```
{% endtab %}

{% tab title="HTTP" %}
```python
# export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.com:6006

from phoenix.otel import register

# sends traces to https://your-phoenix.com/v1/traces
tracer_provider = register(
    protocol="http/protobuf",
)
```
{% endtab %}
{% endtabs %}

#### Specifying the `endpoint` directly

When passing in the `endpoint` argument, **you must specify the fully qualified endpoint**. If the `PHOENIX_GRPC_PORT` environment variable is set, it will override the default gRPC port.

{% tabs %}
{% tab title="HTTP" %}
The HTTP transport protocol is inferred from the endpoint

```python
from phoenix.otel import register
tracer_provider = register(endpoint="http://localhost:6006/v1/traces")
```
{% endtab %}

{% tab title="GRPC" %}
The GRPC transport protocol is inferred from the endpoint

```python
from phoenix.otel import register
tracer_provider = register(endpoint="http://localhost:4317")
```
{% endtab %}

{% tab title="Custom GRPC Port" %}
Additionally, the `protocol` argument can be used to enforce the OTLP transport protocol regardless of the endpoint. This might be useful in cases such as when the GRPC endpoint is bound to a different port than the default (4317). The valid protocols are: `"http/protobuf"`, and `"grpc"`.

```python
from phoenix.otel import register
tracer_provider = register(
    endpoint="http://localhost:9999",
    protocol="grpc", # use "http/protobuf" for http transport
)
```
{% endtab %}
{% endtabs %}

#### Additional configuration

`register` can be configured with different keyword arguments:

* `project_name`: The Phoenix project name
  * or use `PHOENIX_PROJECT_NAME` env. var
* `headers`: Headers to send along with each span payload
  * or use `PHOENIX_CLIENT_HEADERS` env. var
* `batch`: Whether or not to process spans in batch

```python
from phoenix.otel import register
tracer_provider = register(
    project_name="otel-test",
    headers={"Authorization": "Bearer TOKEN"},
    batch=True,
)
```

## Instrumentation

Once you've connected your application to your Phoenix instance using `phoenix.otel.register`, you need to instrument your application. You have a few options to do this:

1. **Using OpenInference auto-instrumentors**. If you've used the `auto_instrument` flag above, then any instrumentor packages in your environment will be called automatically. For a full list of OpenInference packages, see [https://arize.com/docs/phoenix/integrations](https://arize.com/docs/phoenix/integrations "mention")
2. Using [Phoenix Decorators](instrument.md).
3. Using [Base OTEL](custom-spans.md).
