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
