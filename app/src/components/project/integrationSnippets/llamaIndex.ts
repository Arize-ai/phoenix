export function getLlamaIndexCodePython({
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
from llama_index.core.llms import ChatMessage
from llama_index.llms.openai import OpenAI

llm = OpenAI(model="gpt-4o-mini")
response = llm.chat([ChatMessage(role="user", content="Explain the theory of relativity in simple terms.")])`;
}
