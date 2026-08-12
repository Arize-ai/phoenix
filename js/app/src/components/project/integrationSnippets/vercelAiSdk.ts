export function getVercelAiSdkCodeTypescript({
  projectName,
}: {
  projectName: string;
}): string {
  return `import { register } from "@arizeai/phoenix-otel";
import { generateText, registerTelemetry } from "ai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { openai } from "@ai-sdk/openai";

const provider = register({
  projectName: "${projectName}",
});

// AI SDK (v7+) telemetry is process-global; register it once at startup.
// Header capture is disabled because headers can contain credentials.
registerTelemetry(
  new OpenTelemetry({
    tracer: provider.getTracer("@arizeai/phoenix-otel/ai-sdk"),
    headers: false,
  })
);

const result = await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Explain the theory of relativity in simple terms.",
});

// Flush pending traces before the process exits
await provider.forceFlush();`;
}
