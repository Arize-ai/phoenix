import { Mastra } from "@mastra/core";
import { ArizeExporter } from "@mastra/arize";
import { movieAgent } from "./agents/movie-agent";

export const mastra = new Mastra({
  agents: { movieAgent },
  observability: {
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "mastra-project",
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

