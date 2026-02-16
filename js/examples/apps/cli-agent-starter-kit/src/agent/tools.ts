import { tool } from "ai";
import { z } from "zod";

/**
 * Date/Time tool for getting the current date and time
 */
export const getDateTimeTool = tool({
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
