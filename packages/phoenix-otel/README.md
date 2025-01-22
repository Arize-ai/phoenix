# arize-phoenix-otel

Provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults.

These defaults are aware of environment variables you may have set to configure Phoenix:
- `PHOENIX_COLLECTOR_ENDPOINT`
- `PHOENIX_PROJECT_NAME`
- `PHOENIX_CLIENT_HEADERS`
- `PHOENIX_API_KEY`
- `PHOENIX_GRPC_PORT`

# Examples

The `phoenix.otel` module provides a high-level `register` function to configure OpenTelemetry
tracing by setting a global `TracerProvider`. The register function can also configure headers
and whether or not to process spans one by one or by batch.


## Quickstart

```
from phoenix.otel import register
tracer_provider = register()
```

This is all you need to get started using OTel with Phoenix! `register` defaults to sending spans
to an endpoint at `http://localhost` using gRPC.

## Phoenix Authentication

If the `PHOENIX_API_KEY` environment variable is set, `register` will automatically add an
`authorization` header to each span payload.

### Configuring the collector endpoint

There are two ways to configure the collector endpoint:
- Using environment variables
- Using the `endpoint` keyword argument

#### Using environment variables

If you're setting the `PHOENIX_COLLECTOR_ENDPOINT` environment variable, `register` will
automatically try to send spans to your Phoenix server using gRPC.

```
# export PHOENIX_COLLECTOR_ENDPOINT=https://your-phoenix.com:6006

from phoenix.otel import register
tracer_provider = register()
```

#### Specifying the `endpoint` directly

When passing in the `endpoint` argument, **you must specify the fully qualified endpoint**. For
example, in order to export spans via HTTP to localhost, use Pheonix's HTTP collector endpoint:
`http://localhost:6006/v1/traces`. The default gRPC endpoint is different: `http://localhost:4317`.
If the `PHOENIX_GRPC_PORT` environment variable is set, it will override the default gRPC port.

```
from phoenix.otel import register
tracer_provider = register(endpoint="http://localhost:6006/v1/traces")
```

Additionally, the `protocol` argument can be used to enforce the OTLP transport protocol
regardless of the endpoint specified. This might be useful in cases such as when the GRPC
endpoint is bound to a different port than the default (4317). The valid protocols are:
"http/protobuf", and "grpc".

```
from phoenix.otel import register
tracer_provider = register(endpoint="http://localhost:9999", protocol="grpc")
```

### Additional configuration

`register` can be configured with different keyword arguments:
- `project_name`: The Phoenix project name (or `PHOENIX_PROJECT_NAME` env. var)
- `headers`: Headers to send along with each span payload (or `PHOENIX_CLIENT_HEADERS` env. var)
- `batch`: Whether or not to process spans in batch

```
from phoenix.otel import register
tracer_provider = register(
    project_name="otel-test", headers={"Authorization": "Bearer TOKEN"}, batch=True
)
```

## A drop-in replacement for OTel primitives

For more granular tracing configuration, these wrappers can be used as drop-in replacements for
OTel primitives:

```
from opentelemetry import trace as trace_api
from phoenix.otel import HTTPSpanExporter, TracerProvider, SimpleSpanProcessor

tracer_provider = TracerProvider()
span_exporter = HTTPSpanExporter(endpoint="http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

Wrappers have Phoenix-aware defaults to greatly simplify the OTel configuration process. A special
`endpoint` keyword argument can be passed to either a `TracerProvider`, `SimpleSpanProcessor` or
`BatchSpanProcessor` in order to automatically infer which `SpanExporter` to use to simplify setup.

### Using environment variables

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006

from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
```

#### Specifying the `endpoint` directly

```
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider(endpoint="http://localhost:4317")
trace_api.set_tracer_provider(tracer_provider)
```

### Further examples

Users can gradually add OTel components as desired:

## Configuring resources

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006

from opentelemetry import trace as trace_api
from phoenix.otel import Resource, PROJECT_NAME, TracerProvider

tracer_provider = TracerProvider(resource=Resource({PROJECT_NAME: "my-project"}))
trace_api.set_tracer_provider(tracer_provider)
```

## Using a BatchSpanProcessor

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006

from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider, BatchSpanProcessor

tracer_provider = TracerProvider()
batch_processor = BatchSpanProcessor()
tracer_provider.add_span_processor(batch_processor)
```

## Specifying a custom GRPC endpoint

```
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider, BatchSpanProcessor, GRPCSpanExporter

tracer_provider = TracerProvider()
batch_processor = BatchSpanProcessor(
    span_exporter=GRPCSpanExporter(endpoint="http://custom-endpoint.com:6789")
)
tracer_provider.add_span_processor(batch_processor)
```
