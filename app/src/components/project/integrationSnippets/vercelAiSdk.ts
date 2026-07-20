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

// AI SDK (v7+) telemetry is registered automatically by register()
const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
