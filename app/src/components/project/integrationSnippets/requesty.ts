export function getRequestyCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register
import os

tracer_provider = register(
  project_name="${projectName}",
  auto_instrument=True
)

# SDK imports must come after register() so auto-instrumentation can patch them
import openai

client = openai.OpenAI(
  base_url="https://router.requesty.ai/v1",
  api_key=os.environ["REQUESTY_API_KEY"],
)
response = client.chat.completions.create(
  model="openai/gpt-4o-mini",
  messages=[{"role": "user", "content": "Explain the theory of relativity in simple terms."}],
)`;
}

export function getRequestyCodeTypescript({
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

const openai = new OpenAI({
  baseURL: "https://router.requesty.ai/v1",
  apiKey: process.env.REQUESTY_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
