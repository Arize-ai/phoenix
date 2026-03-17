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
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register\n
tracer_provider = register(
  project_name="${projectName}",
  auto_instrument=True
)`;
}

export function getOtelInitCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from '@arizeai/phoenix-otel';

register({
  projectName: '${projectName}',
});`;
}

export function getLanggraphCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
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
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

const provider = register({
  projectName: "${projectName}",
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

export function getLangchainCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import * as CallbackManagerModule from "@langchain/core/callbacks/manager";
import { ChatOpenAI } from "@langchain/openai";

const provider = register({
  projectName: "${projectName}",
});

// LangChain must be manually instrumented as it doesn't have
// a traditional module structure
const lcInstrumentation = new LangChainInstrumentation();
lcInstrumentation.manuallyInstrument(CallbackManagerModule);

const model = new ChatOpenAI({ model: "gpt-4o-mini" });
const result = await model.invoke("Explain the theory of relativity in simple terms.");

// Flush pending traces before the process exits
await provider.forceFlush();`;
}

export function getOpenaiCodeTypescript({
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

const openai = new OpenAI();
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}

export function getAnthropicCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import Anthropic from "@anthropic-ai/sdk";

const provider = register({
  projectName: "${projectName}",
});

const instrumentation = new AnthropicInstrumentation();
instrumentation.manuallyInstrument(Anthropic);

const anthropic = new Anthropic();
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Explain the theory of relativity in simple terms." }],
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}

export function getMastraCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { ArizeExporter } from "@mastra/arize";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { openai } from "@ai-sdk/openai";

const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o-mini"),
});

const mastra = new Mastra({
  agents: { agent },
  observability: new Observability({
    configs: {
      arize: {
        serviceName: "${projectName}",
        exporters: [
          new ArizeExporter({
            endpoint: \`\${process.env.PHOENIX_COLLECTOR_ENDPOINT}/v1/traces\`,
            projectName: "${projectName}",
          }),
        ],
      },
    },
  }),
});

// Run via: mastra dev`;
}

export function getVercelAiSdkCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const provider = register({
  projectName: "${projectName}",
});

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
  experimental_telemetry: { isEnabled: true },
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
