export function getTanStackAiCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { chat, streamToText } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { openInferenceMiddleware } from "@arizeai/openinference-tanstack-ai";

const provider = register({
  projectName: "${projectName}",
});

const stream = chat({
  adapter: openaiText("gpt-4o-mini"),
  messages: [{ role: "user", content: "What is OpenInference?" }],
  middleware: [openInferenceMiddleware()],
});

await streamToText(stream);

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
