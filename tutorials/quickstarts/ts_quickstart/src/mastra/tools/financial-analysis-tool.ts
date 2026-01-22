import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const financialAnalysisTool = createTool({
  id: "financial-analysis",
  description:
    "Runs a complete financial analysis workflow: first conducts research on the given tickers, then compiles the research into a polished financial report. This tool automatically chains the research and writing steps.",
  inputSchema: z.object({
    tickers: z
      .string()
      .describe(
        "Stock ticker symbol(s) to research (e.g., 'TSLA', 'AAPL, MSFT')",
      ),
    focus: z
      .string()
      .describe(
        "The specific focus area for the research (e.g., 'financial analysis and market outlook')",
      ),
  }),
  outputSchema: z.object({
    report: z.string().describe("A polished financial analysis report"),
  }),
  execute: async ({ tickers, focus }, context) => {
    const mastra = context?.mastra;
    if (!mastra) {
      throw new Error("Mastra instance not available in tool context");
    }

    // Step 1: Research phase
    const researcher = mastra.getAgent("financialResearcherAgent");
    if (!researcher) {
      throw new Error("Financial researcher agent not found");
    }

    const research = await researcher.generate([
      { role: "user", content: `Research ${tickers} focusing on ${focus}` },
    ]);

    // Step 2: Writing phase
    const writer = mastra.getAgent("financialWriterAgent");
    if (!writer) {
      throw new Error("Financial writer agent not found");
    }

    const report = await writer.generate([
      {
        role: "user",
        content: `Write a financial report for ${tickers} (focus: ${focus}).

Research: ${research.text}`,
      },
    ]);

    return { report: report.text };
  },
});
