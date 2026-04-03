export function getBasetenCodePython({
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
  base_url="https://inference.baseten.co/v1",
  api_key=os.environ["BASETEN_API_KEY"],
)
response = client.chat.completions.create(
  model="deepseek-ai/DeepSeek-V3.1",
  messages=[{"role": "user", "content": "Describe the main concepts behind transformer architecture."}],
)`;
}

export function getBasetenCodeTypescript({
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
  baseURL: "https://inference.baseten.co/v1",
  apiKey: process.env.BASETEN_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "deepseek-ai/DeepSeek-V3.1",
  messages: [{ role: "user", content: "Describe the main concepts behind transformer architecture." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
