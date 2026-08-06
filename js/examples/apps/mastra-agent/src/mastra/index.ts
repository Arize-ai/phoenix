import { ArizeExporter } from "@mastra/arize";
import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";

import { movieAgent } from "./agents/movie-agent";

// ArizeExporter POSTs to `endpoint` exactly as given, so build the full OTLP
// URL from the collector base URL — handed a bare server URL it posts to the
// wrong path and every span is silently dropped.
const phoenixTracesUrl = `${(process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006").replace(/\/$/, "")}/v1/traces`;

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
