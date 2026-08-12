export function getDaoxeCodePython({
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

# DaoXE is a multi-model multi-protocol gateway.
# This snippet uses the OpenAI Chat Completions path.
# DaoXE is not available in mainland China.
client = openai.OpenAI(
  base_url="https://daoxe.com/v1",
  api_key=os.environ["DAOXE_API_KEY"],
)
response = client.chat.completions.create(
  model="YOUR_DAOXE_MODEL_ID",
  messages=[{"role": "user", "content": "Explain the theory of relativity in simple terms."}],
)`;
}

export function getDaoxeCodeTypescript({
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

// DaoXE is a multi-model multi-protocol gateway.
// This snippet uses the OpenAI Chat Completions path.
// DaoXE is not available in mainland China.
const openai = new OpenAI({
  baseURL: "https://daoxe.com/v1",
  apiKey: process.env.DAOXE_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "YOUR_DAOXE_MODEL_ID",
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
