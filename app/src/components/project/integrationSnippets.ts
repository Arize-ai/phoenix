import { BASE_URL } from "@phoenix/config";

import { HOSTED_PHOENIX_URL } from "./hosting";

// -- Packages for "Trace directly from app" --
export const PYTHON_PACKAGES = ["arize-phoenix-otel"] as const;
export const TYPESCRIPT_PACKAGES = ["@arizeai/phoenix-otel"] as const;

// -- Environment variables --

export function getEnvironmentVariables({
  isAuthEnabled,
  isHosted,
  apiKey,
}: {
  isAuthEnabled: boolean;
  isHosted: boolean;
  apiKey?: string;
}): string {
  const apiKeyValue = apiKey || "<your-api-key>";
  if (isHosted) {
    return `PHOENIX_CLIENT_HEADERS='api_key=${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${HOSTED_PHOENIX_URL}'`;
  } else if (isAuthEnabled) {
    return `PHOENIX_API_KEY='${apiKeyValue}'\nPHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
  }
  return `PHOENIX_COLLECTOR_ENDPOINT='${BASE_URL}'`;
}

// -- Implementation code --

export function getOtelInitCodePython({
  isHosted,
  projectName,
}: {
  isHosted: boolean;
  projectName: string;
}): string {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
  endpoint="${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
  auto_instrument=True
)`;
}

export function getOtelInitCodeTypescript({
  projectName,
  isHosted,
}: {
  projectName: string;
  isHosted: boolean;
}): string {
  return `import { register } from '@arizeai/phoenix-otel';

register({
  projectName: '${projectName}',
  url: '${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}',
  apiKey: process.env.PHOENIX_API_KEY,
});`;
}

export function getLanggraphCodePython({
  isHosted,
  projectName,
}: {
  isHosted: boolean;
  projectName: string;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
  endpoint="${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
  auto_instrument=True
)

# Import LangChain/LangGraph after register() so auto-instrumentation can patch them
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

model = ChatOpenAI(model="gpt-4o-mini")
agent = create_react_agent(model, tools=[])
result = agent.invoke(
  {"messages": [{"role": "user", "content": "Explain the theory of relativity in simple terms."}]}
)`;
}

export function getLanggraphCodeTypescript({
  projectName,
  isHosted,
}: {
  projectName: string;
  isHosted: boolean;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const provider = register({
  projectName: "${projectName}",
  url: "${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
});

// LangChain must be manually instrumented as it doesn't have
// a traditional module structure
const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

const model = new ChatOpenAI({ model: "gpt-4o-mini" });
const agent = createReactAgent({ llm: model, tools: [] });
const result = await agent.invoke(
  { messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }] }
);

// Flush pending traces before the process exits
await provider.forceFlush();`;
}

export function getVercelAiSdkCodeTypescript({
  projectName,
  isHosted,
}: {
  projectName: string;
  isHosted: boolean;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const provider = register({
  projectName: "${projectName}",
  url: "${isHosted ? HOSTED_PHOENIX_URL : BASE_URL}",
});

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
  experimental_telemetry: { isEnabled: true },
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
