export function getCloudflareCodePython({
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

account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
client = openai.OpenAI(
  base_url=f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1",
  api_key=os.environ["CLOUDFLARE_API_KEY"],
)
response = client.chat.completions.create(
  model="@cf/meta/llama-3.1-8b-instruct",
  messages=[{"role": "user", "content": "What are the benefits of edge computing for AI applications?"}],
)`;
}

export function getCloudflareCodeTypescript({
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

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const openai = new OpenAI({
  baseURL: "https://api.cloudflare.com/client/v4/accounts/" + accountId + "/ai/v1",
  apiKey: process.env.CLOUDFLARE_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "@cf/meta/llama-3.1-8b-instruct",
  messages: [{ role: "user", content: "What are the benefits of edge computing for AI applications?" }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
