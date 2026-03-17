export function getOpenaiCodePython({
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
import openai

client = openai.OpenAI()
response = client.chat.completions.create(
  model="gpt-4o-mini",
  messages=[{"role": "user", "content": "Explain the theory of relativity in simple terms."}],
)`;
}

export function getOpenaiCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

const provider = register({
  projectName: "${projectName}",
});

const instrumentation = new OpenAIInstrumentation();
instrumentation.manuallyInstrument(OpenAI);

const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
