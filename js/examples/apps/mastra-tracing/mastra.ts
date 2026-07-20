/**
 * Mastra Tracing Example - Agent and Observability Setup
 *
 * Defines a small tool-calling Mastra agent whose model comes from an
 * AI SDK v7 provider, with traces exported to Phoenix via @mastra/arize.
 */

import { openai } from "@ai-sdk/openai";
import { ArizeExporter } from "@mastra/arize";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { createTool } from "@mastra/core/tools";
import { Observability } from "@mastra/observability";
import { z } from "zod";

const PROJECT_NAME = process.env.PHOENIX_PROJECT_NAME || "mastra-tracing";

const weatherTool = createTool({
  id: "get-weather",
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("The city to look up"),
  }),
  execute: async ({ city }) => {
    // Canned data keeps the example deterministic and offline-friendly
    return {
      city,
      temperatureCelsius: 22,
      conditions: "partly cloudy",
    };
  },
});

export const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather Assistant",
  instructions:
    "You are a helpful weather assistant. Use the get-weather tool to look up current conditions before answering.",
  model: openai("gpt-4o-mini"),
  tools: { weatherTool },
});

export const mastra = new Mastra({
  agents: { weatherAgent },
  observability: new Observability({
    configs: {
      arize: {
        serviceName: PROJECT_NAME,
        exporters: [
          new ArizeExporter({
            endpoint:
              process.env.PHOENIX_COLLECTOR_ENDPOINT || "http://localhost:6006",
            apiKey: process.env.PHOENIX_API_KEY,
            projectName: PROJECT_NAME,
          }),
        ],
      },
    },
  }),
});
