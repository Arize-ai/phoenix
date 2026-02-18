#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  runExperiment,
  type RunExperimentParams,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";

import { agent } from "../../src/agents/index.js";
import { terminalFormatDataset } from "../datasets/index.js";
import { createTerminalSafeFormatEvaluator } from "../evaluators/index.js";
import { printExperimentSummary } from "../utils/index.js";

async function main() {
  const client = createClient();

  // Initialize LLM evaluator (async — creates the classification judge)
  const evaluator = await createTerminalSafeFormatEvaluator();

  // Create or get existing dataset
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });

  // Define task (calls the real agent with the prompt)
  const task: RunExperimentParams["task"] = async (example: Example) => {
    const prompt = example.input?.prompt;
    if (typeof prompt !== "string") {
      throw new Error("Invalid dataset: input.prompt must be a string");
    }
    const result = await agent.generate({ prompt });
    return result.text;
  };

  // Run experiment
  const experimentName = `terminal-format-eval-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: "Evaluate ANSI terminal formatting compliance",
    dataset: { datasetId },
    task,
    evaluators: [evaluator],
  });

  printExperimentSummary({ experiment, experimentName });
}

main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
