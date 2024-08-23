# Using OTEL Python Directly

Even though we recommend using phoenix.otel for simplicity, this is completely your choice! The guides below show you how to use OpenTelemetry directly so that you do not need to depend on any phoenix package. More documentation on configuring OTel can be found on their [docs](https://opentelemetry.io/docs/specs/otel/trace/sdk/).

### Install Dependancies

```bash
pip install opentelemetry-sdk opentelemetry-exporter-otlp
pip install openinference-semantic-conventions
```

### Configure OpenTelemetry

```python
from openinference.semconv.resource import ResourceAttributes

from opentelemetry import trace as trace_api
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

resource = Resource.create({ResourceAttributes.PROJECT_NAME: project_name})
tracer_provider = TracerProvider(resource=resource)
span_exporter = OTLPSpanExporter(endpoint="http://localhost:6006/v1/traces")
span_processor = SimpleSpanProcessor(span_exporter=span_exporter)
tracer_provider.add_span_processor(span_processor)
trace_api.set_tracer_provider(tracer_provider)
```

