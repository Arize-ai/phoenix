#!/usr/bin/env tsx
/* eslint-disable no-console */
import { createClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  runExperiment,
  type RunExperimentParams,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";

import { terminalFormatDataset } from "../datasets/index.js";
import { terminalSafeFormatEvaluator } from "../evaluators/index.js";

async function main() {
  const client = createClient();

  // Create or get existing dataset (silent)
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });

  // Define task (returns pre-defined response from dataset)
  const task: RunExperimentParams["task"] = async (example: Example) => {
    if (typeof example.output?.response !== "string") {
      throw new Error("Invalid dataset: output.response must be a string");
    }
    return example.output.response;
  };

  // Run experiment with quiet logger
  const experimentName = `terminal-format-eval-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: "Evaluate terminal-safe formatting compliance",
    dataset: { datasetId },
    task,
    evaluators: [terminalSafeFormatEvaluator],
    logger: {
      log: () => {}, // Suppress verbose output
      info: () => {},
      error: console.error,
    },
  });

  // Print summary
  const runs = Object.values(experiment.runs);
  const evaluationResults = experiment.evaluationRuns || [];
  const passCount = evaluationResults.filter((r) => r.result.score === 1).length;
  const failCount = evaluationResults.filter((r) => r.result.score === 0).length;

  console.log(`\n✓ Evaluated ${runs.length} examples`);
  console.log(`  ${passCount} passed (${((passCount / runs.length) * 100).toFixed(1)}%)`);
  console.log(`  ${failCount} failed (${((failCount / runs.length) * 100).toFixed(1)}%)`);
  console.log(
    `\n→ View details: http://localhost:6006/datasets/${datasetId}/compare?experimentId=${experiment.id}\n`
  );
}

main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
