// This document is for a correctness eval on tools and goal completion for the agent.

import "dotenv/config";
import { createClassificationEvaluator } from "@arizeai/phoenix-evals";
import { openai } from "@ai-sdk/openai";
import { getSpans, logSpanAnnotations } from "@arizeai/phoenix-client/spans";
import assert from "assert";
import { getDataset } from "@arizeai/phoenix-client/datasets";
import { Agent } from "@mastra/core/agent";

async function main() {
  const dataset = await getDataset({
    dataset: { datasetName: "ts-quickstart" },
  });
  console.log(dataset);
}

main().catch(() => {
  process.exit(1);
});
