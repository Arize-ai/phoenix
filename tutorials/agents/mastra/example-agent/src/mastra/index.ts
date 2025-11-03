// chosen-project-name/src/index.ts
import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";
import { LibSQLStore } from "@mastra/libsql";
import { ArizeExporter } from "@mastra/arize";

import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  agents: { weatherAgent },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: {
    configs: {
      arize: {
        serviceName: process.env.PHOENIX_PROJECT_NAME || "weather-agent",
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
