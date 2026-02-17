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

  // Create or get existing dataset
  console.log("Creating or retrieving dataset...");
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });
  console.log(`Dataset ID: ${datasetId}`);

  // Define task (returns pre-defined response from dataset)
  const task: RunExperimentParams["task"] = async (example: Example) => {
    if (typeof example.output?.response !== "string") {
      throw new Error("Invalid dataset: output.response must be a string");
    }
    return example.output.response;
  };

  // Run experiment
  console.log("Running experiment...");
  const experimentName = `terminal-format-eval-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: "Evaluate terminal-safe formatting compliance",
    dataset: { datasetId },
    task,
    evaluators: [terminalSafeFormatEvaluator],
    logger: console,
  });

  console.log("\nExperiment completed!");
  console.log(`Experiment ID: ${experiment.id}`);
  console.log(`Dataset ID: ${datasetId}`);
  console.log(
    `\nView results: http://localhost:6006/datasets/${datasetId}/compare?selectedExperiments=${experiment.id}`
  );

  // Print summary
  const runs = Object.values(experiment.runs);
  const evaluationResults = experiment.evaluationRuns || [];
  const passCount = evaluationResults.filter((r) => r.result.score === 1).length;
  const failCount = evaluationResults.filter((r) => r.result.score === 0).length;

  console.log("\n--- Summary ---");
  console.log(`Total examples: ${runs.length}`);
  console.log(`Passed: ${passCount} (${((passCount / runs.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failCount} (${((failCount / runs.length) * 100).toFixed(1)}%)`);
}

main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
