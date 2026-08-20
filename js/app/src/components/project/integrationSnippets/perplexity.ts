export function getPerplexityCodePython({
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
  base_url="https://api.perplexity.ai",
  api_key=os.environ["PERPLEXITY_API_KEY"],
)
response = client.chat.completions.create(
  model="sonar",
  messages=[{"role": "user", "content": "What are the latest developments in renewable energy?"}],
)`;
}

export function getPerplexityCodeTypescript({
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
  baseURL: "https://api.perplexity.ai",
  apiKey: process.env.PERPLEXITY_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "sonar",
  messages: [{ role: "user", content: "What are the latest developments in renewable energy?" }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
