export function getStrandsAgentsCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `# Strands uses its own OpenTelemetry telemetry instead of phoenix.otel.register()
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry import trace as trace_api
from strands.telemetry import StrandsTelemetry
from openinference.instrumentation.strands_agents import StrandsAgentsToOpenInferenceProcessor

resource = Resource.create({"openinference.project.name": "${projectName}"})
provider = TracerProvider(resource=resource)
trace_api.set_tracer_provider(provider)

telemetry = StrandsTelemetry(tracer_provider=provider)
telemetry.tracer_provider.add_span_processor(StrandsAgentsToOpenInferenceProcessor())
telemetry.setup_otlp_exporter(endpoint="http://localhost:6006/v1/traces")

from strands import Agent
from strands.models.openai import OpenAIModel

model = OpenAIModel(model_id="gpt-4o-mini")
agent = Agent(
  model=model,
  system_prompt="You are a helpful assistant.",
)

result = agent("Explain the theory of relativity in simple terms.")`;
}
