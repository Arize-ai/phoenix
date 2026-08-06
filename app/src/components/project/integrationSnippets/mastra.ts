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
          // ArizeExporter POSTs to \`endpoint\` exactly as given, so build the
          // full OTLP URL from the collector base URL — handed a bare server
          // URL it posts to the wrong path and every span is silently dropped.
          new ArizeExporter({
            endpoint: \`\${(process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006").replace(/\\/$/, "")}/v1/traces\`,
            projectName: "${projectName}",
          }),
        ],
      },
    },
  }),
});

// Run via: mastra dev`;
}
