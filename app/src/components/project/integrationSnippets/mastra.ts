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

// ArizeExporter POSTs to this URL as given, so it must include the OTLP path.
// Set PHOENIX_COLLECTOR_ENDPOINT to e.g. http://localhost:6006/v1/traces
const tracesEndpoint =
  process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006/v1/traces";

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
            endpoint: tracesEndpoint,
            projectName: "${projectName}",
          }),
        ],
      },
    },
  }),
});

// Run via: mastra dev`;
}
