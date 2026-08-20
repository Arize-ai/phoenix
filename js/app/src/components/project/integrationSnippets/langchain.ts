export function getLangchainCodePython({
  projectName,
}: {
  projectName: string;
}): string {
  return `from phoenix.otel import register

tracer_provider = register(
  project_name="${projectName}",
  auto_instrument=True
)

# SDK imports must come after register() so auto-instrumentation can patch them
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

prompt = ChatPromptTemplate.from_template("Explain {topic} in simple terms.")
chain = prompt | ChatOpenAI(model="gpt-4o-mini")
response = chain.invoke({"topic": "the theory of relativity"})`;
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
