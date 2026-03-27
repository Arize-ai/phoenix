export function getTogetherCodePython({
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
  base_url="https://api.together.xyz/v1",
  api_key=os.environ["TOGETHER_API_KEY"],
)
response = client.chat.completions.create(
  model="meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  messages=[{"role": "user", "content": "Explain how neural networks learn from data."}],
)`;
}

export function getTogetherCodeTypescript({
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
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
  messages: [{ role: "user", content: "Explain how neural networks learn from data." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
