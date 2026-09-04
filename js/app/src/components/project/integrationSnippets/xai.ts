export function getXaiCodePython({
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
  base_url="https://api.x.ai/v1",
  api_key=os.environ["XAI_API_KEY"],
)
response = client.chat.completions.create(
  model="grok-4.1-mini",
  messages=[{"role": "user", "content": "What is the significance of the Turing test in AI?"}],
)`;
}

export function getXaiCodeTypescript({
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
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "grok-4.1-mini",
  messages: [{ role: "user", content: "What is the significance of the Turing test in AI?" }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
