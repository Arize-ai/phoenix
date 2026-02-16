import { tool } from "ai";
import { z } from "zod";

/**
 * Calculator tool for performing mathematical calculations
 */
export const calculatorTool = tool({
  description: "Perform mathematical calculations",
  inputSchema: z.object({
    expression: z.string().describe("The mathematical expression to evaluate"),
  }),
  execute: async ({ expression }: { expression: string }) => {
    try {
      // Simple eval for demo purposes - in production, use a safe math parser
      const result = eval(expression);
      return { result, expression };
    } catch (error) {
      return { error: String(error), expression };
    }
  },
});

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
