import { createClient, type PhoenixClient } from "@arizeai/phoenix-client";
import { createOrGetDataset } from "@arizeai/phoenix-client/datasets";
import {
  runExperiment,
  type RunExperimentParams,
} from "@arizeai/phoenix-client/experiments";
import type { Example } from "@arizeai/phoenix-client/types/datasets";

import { terminalFormatDataset } from "../datasets/index.js";
import { terminalSafeFormatEvaluator } from "../evaluators/index.js";

export type RunTerminalFormatEvalParams = {
  client?: PhoenixClient;
  logger?: Pick<Console, "log" | "error">;
};

// Metadata for CLI auto-discovery
export const metadata = {
  name: "Terminal Safe Format",
  description: "Verify outputs don't contain markdown syntax",
  hint: "Checks for bold, italic, code blocks, links, and headings",
};

export async function runTerminalFormatEval({
  client: _client,
  logger = console,
}: RunTerminalFormatEvalParams = {}) {
  const client = _client || createClient();

  // Create or get existing dataset
  logger.log("Creating or retrieving dataset...");
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });
  logger.log(`Dataset ID: ${datasetId}`);

  // Define task (returns pre-defined response from dataset)
  const task: RunExperimentParams["task"] = async (example: Example) => {
    // Return the output from the dataset
    if (typeof example.output?.response !== "string") {
      throw new Error("Invalid dataset: output.response must be a string");
    }
    return example.output.response;
  };

  // Run experiment
  logger.log("Running experiment...");
  const experimentName = `terminal-format-eval-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: "Evaluate terminal-safe formatting compliance",
    dataset: { datasetId },
    task,
    evaluators: [terminalSafeFormatEvaluator],
    logger,
  });

  logger.log("\nExperiment completed!");
  logger.log(`Experiment ID: ${experiment.id}`);
  logger.log(`Dataset ID: ${datasetId}`);
  logger.log(
    `\nView results: http://localhost:6006/datasets/${datasetId}/compare?selectedExperiments=${experiment.id}`
  );

  // Print summary
  const runs = Object.values(experiment.runs);
  const evaluationResults = experiment.evaluationRuns || [];
  const passCount = evaluationResults.filter((r) => r.result.score === 1).length;
  const failCount = evaluationResults.filter((r) => r.result.score === 0).length;

  logger.log("\n--- Summary ---");
  logger.log(`Total examples: ${runs.length}`);
  logger.log(`Passed: ${passCount} (${((passCount / runs.length) * 100).toFixed(1)}%)`);
  logger.log(`Failed: ${failCount} (${((failCount / runs.length) * 100).toFixed(1)}%)`);

  return experiment;
}

// Allow direct invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  runTerminalFormatEval()
    .then(() => process.exit(0))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Evaluation failed:", error);
      process.exit(1);
    });
}
