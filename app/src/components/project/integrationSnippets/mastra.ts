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
          new ArizeExporter({
            endpoint: \`\${process.env.PHOENIX_COLLECTOR_ENDPOINT}/v1/traces\`,
            projectName: "${projectName}",
          }),
        ],
      },
    },
  }),
});

// Run via: mastra dev`;
}
