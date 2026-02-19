#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import {
  createOrGetDataset,
  getDatasetExamples,
} from "@arizeai/phoenix-client/datasets";
import {
  runExperiment,
  type RunExperimentParams,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";

import { terminalFormatDataset } from "../datasets/index.js";
import { createTerminalSafeFormatEvaluator } from "../evaluators/index.js";
import {
  computeConfusionMatrix,
  printConfusionMatrix,
  printExperimentSummary,
} from "../utils/index.js";

async function main() {
  const client = createClient();

  // Initialize LLM evaluator
  const evaluator = await createTerminalSafeFormatEvaluator();

  // Create or reuse the existing golden dataset
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });

  // Fetch server-side examples to get their assigned IDs
  const { examples: examplesWithIds } = await getDatasetExamples({
    client,
    dataset: { datasetId },
  });

  // Build ground truth map: exampleId -> expected label
  const groundTruthByExampleId = new Map<string, string>();
  for (const example of examplesWithIds) {
    const expectedLabel = example.metadata?.expectedSafe ? "compliant" : "non_compliant";
    groundTruthByExampleId.set(example.id, expectedLabel);
  }

  // Task: return the pre-labeled response directly — no agent call
  const task: RunExperimentParams["task"] = async (example: Example) => {
    const response = example.output?.response;
    if (typeof response !== "string") {
      throw new Error("Dataset example missing output.response string");
    }
    return response;
  };

  // Run experiment
  const experimentName = `terminal-format-benchmark-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: "Benchmark terminal-safe-format evaluator accuracy against golden dataset",
    dataset: { datasetId },
    task,
    evaluators: [evaluator],
  });

  // Per-example detail table
  printExperimentSummary({ experiment, experimentName });

  // Confusion matrix benchmark result
  const matrix = computeConfusionMatrix({
    experiment,
    groundTruthByExampleId,
    evaluatorName: "terminal-safe-format",
    positiveLabel: "compliant",
    negativeLabel: "non_compliant",
  });
  printConfusionMatrix(matrix);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
