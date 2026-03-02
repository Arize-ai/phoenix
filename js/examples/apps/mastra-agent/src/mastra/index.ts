import { ArizeExporter } from "@mastra/arize";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";

import { movieAgent } from "./agents/movie-agent";

export const mastra = new Mastra({
  agents: { movieAgent },
  observability: new Observability({
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
  }),
});
