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
          // ArizeExporter POSTs to `endpoint` exactly as given, so the OTLP
          // path is appended here — PHOENIX_COLLECTOR_ENDPOINT is a base URL
          // (a trailing slash would 404 as //v1/traces, silently dropping spans).
          new ArizeExporter({
            endpoint: `${(process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006").replace(/\/+$/, "")}/v1/traces`,
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: process.env.PHOENIX_PROJECT_NAME,
          }),
        ],
      },
    },
  }),
});
