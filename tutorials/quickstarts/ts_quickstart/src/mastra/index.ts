import { Mastra } from "@mastra/core/mastra";
import { ArizeExporter } from "@mastra/arize";
import { financialOrchestratorAgent } from "./agents/financial-orchestrator-agent";
import { financialResearcherAgent } from "./agents/financial-researcher-agent";
import { financialWriterAgent } from "./agents/financial-writer-agent";

export const mastra = new Mastra({
  agents: {
    financialOrchestratorAgent,
    financialResearcherAgent,
    financialWriterAgent,
  },
  observability: {
    configs: {
      arize: {
        serviceName:
          process.env.PHOENIX_PROJECT_NAME || "mastra-tracing-quickstart",
        exporters: [
          new ArizeExporter({
            endpoint: process.env.PHOENIX_ENDPOINT!,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  },
});
