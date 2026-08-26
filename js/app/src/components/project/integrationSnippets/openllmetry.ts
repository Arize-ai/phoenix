export function getOpenLLMetryCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from openinference.instrumentation.openllmetry import OpenInferenceSpanProcessor
from phoenix.otel import SimpleSpanProcessor
from opentelemetry.instrumentation.openai import OpenAIInstrumentor
from opentelemetry import trace

tracer_provider = TracerProvider(
  resource=Resource.create({"openinference.project.name": "${projectName}"})
)
tracer_provider.add_span_processor(OpenInferenceSpanProcessor())
tracer_provider.add_span_processor(SimpleSpanProcessor(protocol="http/protobuf"))
trace.set_tracer_provider(tracer_provider)

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# SDK imports must come after instrument() so OpenLLMetry can patch them
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
  model="gpt-4o-mini",
  messages=[{"role": "user", "content": "Explain the theory of relativity in simple terms."}],
)`;
}
