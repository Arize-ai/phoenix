export function getAgnoCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
  auto_instrument=True
)

# SDK imports must come after register() so auto-instrumentation can patch them
from agno.agent import Agent
from agno.models.openai import OpenAIChat

agent = Agent(model=OpenAIChat(id="gpt-4o-mini"))
agent.print_response("Explain the theory of relativity in simple terms.")`;
}
