import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().min(1).describe("The city to look up"),
  }),
  // Canned data keeps the example deterministic and offline-friendly
  execute: async ({ city }) => ({
    city,
    temperatureCelsius: 22,
    conditions: "partly cloudy",
  }),
});
