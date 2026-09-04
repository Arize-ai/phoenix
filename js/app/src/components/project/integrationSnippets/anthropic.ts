export function getAnthropicCodePython({
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
import anthropic

client = anthropic.Anthropic()
message = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  messages=[{"role": "user", "content": "Explain the theory of relativity in simple terms."}],
)`;
}

export function getAnthropicCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import Anthropic from "@anthropic-ai/sdk";

const provider = register({
  projectName: "${projectName}",
});

const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

const anthropic = new Anthropic();
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
