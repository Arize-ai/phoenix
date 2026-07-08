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
