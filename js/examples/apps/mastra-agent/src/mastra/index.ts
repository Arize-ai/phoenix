import { ArizeExporter } from "@mastra/arize";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";

import { movieAgent } from "./agents/movie-agent";

// ArizeExporter POSTs to this URL as given, so it needs the OTLP path.
const phoenixTracesUrl = `${process.env.PHOENIX_COLLECTOR_ENDPOINT}/v1/traces`;

export const mastra = new Mastra({
  agents: { movieAgent },
  observability: new Observability({
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "mastra-project",
        exporters: [
          new ArizeExporter({
            endpoint: phoenixTracesUrl,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  }),
});
