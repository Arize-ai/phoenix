#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import {
  createOrGetDataset,
  getDatasetExamples,
} from "@arizeai/phoenix-client/datasets";
import {
  asExperimentEvaluator,
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

  // Initialize LLM evaluator — this is the thing being benchmarked
  const evaluator = await createTerminalSafeFormatEvaluator();

  // Create or reuse the benchmark dataset (separate from the task evaluation
  // dataset so benchmark experiments are tracked under their own dataset in Phoenix)
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.benchmarkName,
    description: terminalFormatDataset.benchmarkDescription,
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
    const expectedLabel = example.metadata?.expectedSafe
      ? "compliant"
      : "non_compliant";
    groundTruthByExampleId.set(example.id, expectedLabel);
  }

  // Task: invoke the LLM evaluator on the pre-labeled response.
  // The evaluator is what we're testing — its predicted label is the task output.
  const task: RunExperimentParams["task"] = async (example: Example) => {
    const response = example.output?.response;
    if (typeof response !== "string") {
      throw new Error("Dataset example missing output.response string");
    }
    const result = await evaluator.evaluate({
      input: example.input,
      output: response,
      expected: example.output,
      metadata: example.metadata,
    });
    return result.label ?? "unknown";
  };

  // Exact match evaluator: score = 1 when the evaluator's predicted label matches
  // the ground truth label. Returns the predicted label so the confusion matrix
  // can compare predictions to ground truth by evaluator label.
  const exactMatchEvaluator = asExperimentEvaluator({
    name: "exact-match",
    kind: "CODE",
    evaluate: ({ output, metadata }) => {
      const expectedLabel = metadata?.expectedSafe
        ? "compliant"
        : "non_compliant";
      const predictedLabel = typeof output === "string" ? output : "unknown";
      const match = predictedLabel === expectedLabel;
      return {
        score: match ? 1 : 0,
        label: predictedLabel,
        explanation: `Expected: ${expectedLabel}, Got: ${predictedLabel}`,
      };
    },
  });

  // Run experiment
  const experimentName = `terminal-format-benchmark-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription:
      "Benchmark terminal-safe-format evaluator accuracy against golden dataset",
    dataset: { datasetId },
    task,
    evaluators: [exactMatchEvaluator],
  });

  // Per-example detail table
  printExperimentSummary({ experiment, experimentName });

  // Confusion matrix benchmark result
  const matrix = computeConfusionMatrix({
    experiment,
    groundTruthByExampleId,
    evaluatorName: "exact-match",
    positiveLabel: "compliant",
    negativeLabel: "non_compliant",
  });
  printConfusionMatrix(matrix);
}

main().catch((error) => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});
