# arize-phoenix-otel

Provides a lightweight wrapper around OpenTelemetry primitives with Phoenix-aware defaults.

Our defaults are aware of the `PHOENIX_COLLECTOR_ENDPOINT`, and `PHOENIX_PROJECT_NAME` settings

# Examples

Our wrappers can be used as drop-in replacements for the default OTel primitives:

```
from opentelemetry import trace as trace_api
from phoenix.otel import HTTPSpanExporter, TracerProvider, SimpleSpanProcessor

tracer_provider = TracerProvider()
span_exporter = HTTPSpanExporter("http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

However, we supply Phoenix-aware defaults to greatly simplify the OTel configuration process.

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
```

This is aware of the different kinds of endpoints that are available, an endpoint that isn't
pointing to our rest router will be assumed to be a gRPC endpoint.

```
# export PHOENIX_COLLECTOR_ENDPOINT=http://localhost:4317
from opentelemetry import trace as trace_api
from phoenix.otel import TracerProvider

tracer_provider = TracerProvider()
trace_api.set_tracer_provider(tracer_provider)
```

Alternatively, the endpoint can be passed directly to the tracer provider.

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
