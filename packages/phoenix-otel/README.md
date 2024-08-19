# arize-phoenix-otel

Provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults.

These defaults are aware of the `PHOENIX_COLLECTOR_ENDPOINT`, `PHOENIX_PROJECT_NAME`, and
``PHOENIX_CLIENT_HEADERS` environment variables.

# Examples

The `phoenix.otel` module provides a high-level `register` function to configure OpenTelemetry
tracing by setting a global `TracerProvider`. The register function can also configure headers
and whether or not to process spans one by one or by batch.

```
from phoenix.otel import register

tracer_provider = register(endpoint="http://localhost:6006/v1/traces", project_name="test")
```

For more granular tracing configuration, these wrappers can be used as drop-in replacements for
OTel primitives:

```
from opentelemetry import trace as trace_api
from phoenix.otel import HTTPSpanExporter, TracerProvider, SimpleSpanProcessor

tracer_provider = TracerProvider()
span_exporter = HTTPSpanExporter(endpoint="http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(exporter=span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

Wrappers have Phoenix-aware defaults to greatly simplify the OTel configuration process.

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
```

Phoenix supports sending traces via either an HTTP or gRPC protocol, if possible, the exporter
will be inferred from the endpoint URL. In the following example, tracing is configured to
export traces via the gRPC protocol based on the `PHOENIX_COLLECTOR_ENDPOINT` URL.

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:4317
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
```

The collector endpoint can be passed directly to the tracer provider.

```
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider(endpoint="http://localhost:6006/v1/traces")
trace_api.set_tracer_provider(tracer_provider)
```

Users can gradually add OTel components as desired:

## Adding resources
```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:4317
from opentelemetry import trace as trace_api
from phoenix.otel import Resource, PROJECT_NAME, TracerProvider

tracer_provider = TracerProvider(resource=Resource({PROJECT_NAME: "my-project"}))
trace_api.set_tracer_provider(tracer_provider)
```

## Using a BatchSpanProcessor
```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:4317
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider, BatchSpanProcessor

tracer_provider = TracerProvider()
batch_processor = BatchSpanProcessor()
tracer_provider.add_span_processor(batch_processor)
```
