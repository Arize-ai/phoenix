---
description: Instrument LLM calls to AWS Bedrock via the boto3 client using OpenInference.
---

# Bedrock

boto3 provides Python bindings to AWS services, including Bedrock, which provides access to a number of foundation models. Calls to these models can be instrumented using OpenInference, enabling OpenTelemetry-compliant observability of applications built using these models. Traces collected using OpenInference can be viewed in Phoenix.

## Traces

OpenInference Traces collect telemetry data about the execution of your LLM application. Consider using this instrumentation to understand how a Bedrock-managed models are being called inside a complex system and to troubleshoot issues such as extraction and response synthesis.

To get started instrumenting Bedrock calls via boto3, we need to install three components: Phoenix, which acts as a trace collector, the OpenInference instrumentation for AWS Bedrock, and an OpenTelemetry exporter used to send these traces to Phoenix.

```sh
pip install arize-phoenix
pip install openinference-instrumentation-bedrock
pip install opentelemetry-exporter-otlp
```

Launch a Phoenix server to collect OpenInference traces.

```python
import phoenix as px
session = px.launch_app()
```

After starting a Phoenix server, instrument `boto3` prior to initializing a `bedrock-runtime` client. All clients created after instrumentation will send traces on all calls to `invoke_model`.

```python

import boto3
from openinference.instrumentation.bedrock import BedrockInstrumentor
from opentelemetry import trace as trace_api
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

resource = Resource(attributes={})
tracer_provider = trace_sdk.TracerProvider(resource=resource)
span_console_exporter = ConsoleSpanExporter()
# point the SpanExporter to the Phoenix server URL
span_otlp_exporter = OTLPSpanExporter(endpoint="http://127.0.0.1:6006/v1/traces")
tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter=span_console_exporter))
tracer_provider.add_span_processor(SimpleSpanProcessor(span_exporter=span_otlp_exporter))
trace_api.set_tracer_provider(tracer_provider=tracer_provider)

BedrockInstrumentor().instrument()

session = boto3.session.Session()
client = session.client("bedrock-runtime")

```

```
# All calls to invoke_model are instrumented
prompt = (
    b'{"prompt": "Human: Hello there, how are you? Assistant:", "max_tokens_to_sample": 1024}'
)
response = client.invoke_model(modelId="anthropic.claude-v2", body=prompt)
response_body = json.loads(response.get("body").read())
print(response_body["completion"])
```
