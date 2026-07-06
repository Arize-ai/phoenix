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

export function getOpenaiAgentsCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { OpenAIAgentsInstrumentation } from "@arizeai/openinference-instrumentation-openai-agents";
import * as agents from "@openai/agents";

const provider = register({
  projectName: "${projectName}",
});

// The Agents SDK exposes a first-class tracing API, so the instrumentation
// registers a trace processor rather than patching the module
const instrumentation = new OpenAIAgentsInstrumentation({
  tracerProvider: provider,
});
instrumentation.manuallyInstrument(agents);

const agent = new agents.Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant.",
});
const result = await agents.run(
  agent,
  "Explain the theory of relativity in simple terms."
);

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
