import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export const financialSearchTool = createTool({
  id: "financial-search",
  description:
    "Search for up-to-date financial data, trends, news, stock prices, financial ratios (P/E, P/B, debt-to-equity, ROE, etc.), revenue, earnings, and recent developments for companies. Returns comprehensive financial research data.",
  inputSchema: z.object({
    tickers: z
      .string()
      .describe(
        "Stock ticker symbol(s) to research (e.g., 'TSLA', 'AAPL', 'AAPL, MSFT' for multiple)",
      ),
    focus: z
      .string()
      .describe(
        "The specific focus area for the research (e.g., 'financial analysis and market outlook', 'valuation metrics and growth prospects')",
      ),
  }),
  outputSchema: z.object({
    research: z.string().describe("Comprehensive financial research summary"),
  }),
  execute: async ({ context }) => {
    const { tickers, focus } = context;
    const model = openai("gpt-4o-mini");

    const prompt = `Provide comprehensive financial data for ${tickers} focusing on ${focus}.

Include: current stock price, key financial ratios (P/E, P/B, ROE, etc.), revenue/earnings, recent news (last 6 months), and market trends.`;

    try {
      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        temperature: 0.7,
      });

      const text =
        result.content.find((part) => part.type === "text")?.text || "";
      return { research: text };
    } catch (error) {
      return {
        research: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
