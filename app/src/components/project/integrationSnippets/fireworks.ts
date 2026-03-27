export function getFireworksCodePython({
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
  base_url="https://api.fireworks.ai/inference/v1",
  api_key=os.environ["FIREWORKS_API_KEY"],
)
response = client.chat.completions.create(
  model="accounts/fireworks/models/deepseek-v3p1",
  messages=[{"role": "user", "content": "What are the key principles of distributed computing?"}],
)`;
}

export function getFireworksCodeTypescript({
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
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: process.env.FIREWORKS_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "accounts/fireworks/models/deepseek-v3p1",
  messages: [{ role: "user", content: "What are the key principles of distributed computing?" }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
