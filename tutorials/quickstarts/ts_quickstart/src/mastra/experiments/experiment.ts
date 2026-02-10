import "dotenv/config";
import { getDataset } from "@arizeai/phoenix-client/datasets";
import type { Example } from "@arizeai/phoenix-client/types/datasets";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { financialSearchTool } from "../tools/financial-search-tool";
import { financialOrchestratorAgent } from "../agents/financial-orchestrator-agent";
import { financialWriterAgent } from "../agents/financial-writer-agent";
import { financialCompletenessTemplate } from "../evals/evals";

const financialResearcherAgent = new Agent({
  id: "financial-researcher-agent",
  name: "Financial Research Analyst",
  instructions: `You are a Senior Financial Research Analyst. Your job is to collect accurate, up-to-date financial information so a report writer can turn it into a polished analysis.

What to do:
- Use the financialSearch tool to look up each company or ticker mentioned in the request.
- For every ticker, pull: current or recent prices, key ratios (P/E, P/B, debt-to-equity, ROE), revenue and earnings, and notable news or events from the last 6 months.
- If the user asks for a specific focus (e.g. valuation, growth, dividends), prioritize that in your search and summary.
- For multiple tickers, run research per ticker and then summarize in one coherent research brief.

Output:
- Produce a single research summary that covers all requested tickers and focus areas.
- Be specific: use numbers and sources, not vague statements.
- Write so the Financial Report Writer can use this summary directly to draft the final report. 

Make sure to report finanical data for all tickers mentioned in the request. Use that financial data for the specific focus area mentioned in the request.`,
  model: "openai/gpt-4o",
  tools: { financialSearchTool },
});

async function main() {
  const mastra = new Mastra({
    agents: {
      financialResearcherAgent,
      financialWriterAgent,
      financialOrchestratorAgent,
    },
  });

  const task = async (example: Example): Promise<string> => {
    const raw = example.input as unknown as
      | { role: "user"; content: string }[]
      | { input: { role: "user"; content: string }[] };
    const messages = Array.isArray(raw) ? raw : raw.input;
    const response = await mastra
      .getAgent("financialOrchestratorAgent")
      .generate(messages);
    return response.text ?? "";
  };

  const completenessEvaluator = createClassificationEvaluator({
    model: openai("gpt-4o-mini"),
    promptTemplate: financialCompletenessTemplate,
    choices: { complete: 1, incomplete: 0 },
    name: "completeness",
  });

  const datasetSelector = { datasetName: "ts quickstart fails" };

  await runExperiment({
    dataset: datasetSelector,
    task,
    evaluators: [completenessEvaluator],
    experimentName: "new-experiment",
  });
}

main().catch(() => {
  process.exit(1);
});
