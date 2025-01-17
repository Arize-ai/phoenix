import json

from openai import OpenAI
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.client import Client
from phoenix.client.helpers.sdk.openai.chat import to_kwargs

endpoint = "http://127.0.0.1:6006/v1/traces"
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

version_id = "UHJvbXB0VmVyc2lvbjo4"
prompt_version = Client().prompts.get_version_by_id(version_id)

kwargs = to_kwargs(prompt_version, variables={"question": "hello"})
print(json.dumps(kwargs, indent=2))

response = OpenAI().chat.completions.create(**kwargs)
print(response.choices[0].message.model_dump_json(indent=2))
