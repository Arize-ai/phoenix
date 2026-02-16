import { tool } from "ai";
import { z } from "zod";

/**
 * Date and time utility tool
 * Provides current date and time in multiple formats
 */
export const dateTimeTool = tool({
  description: "Get the current date and time",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      iso: now.toISOString(),
    };
  },
});
