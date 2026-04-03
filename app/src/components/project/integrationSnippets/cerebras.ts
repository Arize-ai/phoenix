export function getCerebrasCodePython({
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
  base_url="https://api.cerebras.ai/v1",
  api_key=os.environ["CEREBRAS_API_KEY"],
)
response = client.chat.completions.create(
  model="llama3.1-8b",
  messages=[{"role": "user", "content": "What makes large language models effective at understanding context?"}],
)`;
}

export function getCerebrasCodeTypescript({
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
  baseURL: "https://api.cerebras.ai/v1",
  apiKey: process.env.CEREBRAS_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "llama3.1-8b",
  messages: [{ role: "user", content: "What makes large language models effective at understanding context?" }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
