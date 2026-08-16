export function getStrandsAgentsCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import HTTPSpanExporter, SimpleSpanProcessor, register
from openinference.instrumentation.strands_agents import StrandsAgentsToOpenInferenceProcessor

# Strands reads the global tracer provider, so start with register() to make
# Phoenix's provider the process-wide default.
tracer_provider = register(
  project_name="${projectName}",
)
# This processor rewrites Strands' native spans into OpenInference spans, so it
# must run before the Phoenix exporter that sends spans to your collector.
tracer_provider.add_span_processor(StrandsAgentsToOpenInferenceProcessor())
tracer_provider.add_span_processor(
  SimpleSpanProcessor(HTTPSpanExporter()),
)

from strands import Agent
from strands.models.openai import OpenAIModel

model = OpenAIModel(model_id="gpt-4o-mini")
agent = Agent(
  model=model,
  system_prompt="You are a helpful assistant.",
)

result = agent("Explain the theory of relativity in simple terms.")
`;
}
