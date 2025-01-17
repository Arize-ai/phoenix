import json

from anthropic import Anthropic
from openinference.instrumentation.anthropic import AnthropicInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.client import Client
from phoenix.client.helpers.sdk.anthropic.messages import to_kwargs

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

AnthropicInstrumentor().instrument(tracer_provider=tracer_provider)

version_id = "UHJvbXB0VmVyc2lvbjo5"
prompt_version = Client().prompts.get_version_by_id(version_id)

kwargs = to_kwargs(prompt_version, variables={"question": "hello"})
print(json.dumps(kwargs, indent=2))

response = Anthropic().messages.create(**kwargs)
print(response.model_dump_json(indent=2))
