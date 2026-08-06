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

// ArizeExporter POSTs to the endpoint exactly as given, so build the full OTLP
// URL here. Handed a bare server URL it posts to the wrong path, and the
// batching exporter swallows the error — every span is lost with nothing logged.
const phoenixBaseUrl =
  process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006";
const phoenixTracesUrl = \`\${phoenixBaseUrl.replace(/\\/$/, "")}/v1/traces\`;

const mastra = new Mastra({
  agents: { agent },
  observability: new Observability({
    configs: {
      arize: {
        serviceName: "${projectName}",
        exporters: [
          new ArizeExporter({
            endpoint: phoenixTracesUrl,
            projectName: "${projectName}",
          }),
        ],
      },
    },
  }),
});

// Run via: mastra dev`;
}
