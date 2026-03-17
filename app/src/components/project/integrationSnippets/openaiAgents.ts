export function getOpenaiAgentsCodePython({
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
from agents import Agent, Runner

agent = Agent(name="Assistant", instructions="You are a helpful assistant.")
result = Runner.run_sync(agent, "Explain the theory of relativity in simple terms.")`;
}
