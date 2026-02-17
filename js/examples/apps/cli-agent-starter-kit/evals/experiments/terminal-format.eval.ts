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
import { terminalSafeFormatEvaluator } from "../evaluators/index.js";

async function main() {
  const client = createClient();

  // Use compliant examples for live testing (to avoid API costs)
  const testSplits = ["compliant"];
  const testExamples = terminalFormatDataset.examples.filter((ex) =>
    ex.splits?.some((split) => testSplits.includes(split))
  );

  console.log("\n🔍 Terminal Safe Format Evaluation");
  console.log(`   Testing ${testExamples.length} examples with live agent`);
  console.log(`   Splits: ${testSplits.join(", ")}\n`);

  // Create or get existing dataset
  const { datasetId } = await createOrGetDataset({
    client,
    name: terminalFormatDataset.name,
    description: terminalFormatDataset.description,
    examples: terminalFormatDataset.examples,
  });

  // Track progress
  let completed = 0;
  const total = testExamples.length;

  // Define task (calls the real agent with the prompt)
  const task: RunExperimentParams["task"] = async (example: Example) => {
    const prompt = example.input?.prompt;
    if (typeof prompt !== "string") {
      throw new Error("Invalid dataset: input.prompt must be a string");
    }

    // Show progress
    completed++;
    console.log(
      `  [${completed}/${total}] Evaluating: "${prompt.substring(0, 50)}..."`
    );

    // Call the agent
    const result = await agent.generate({ prompt });
    return result.text || "";
  };

  // Run experiment with quiet logger
  const experimentName = `terminal-format-${Date.now()}`;
  const experiment = await runExperiment({
    client,
    experimentName,
    experimentDescription: `Terminal-safe formatting (splits: ${testSplits.join(", ")})`,
    dataset: {
      datasetId,
      // Filter to only test examples with specific splits
      splits: testSplits,
    },
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
  const passCount = evaluationResults.filter(
    (r) => r.result?.score === 1
  ).length;
  const failCount = evaluationResults.filter(
    (r) => r.result?.score === 0
  ).length;

  console.log(`\n✓ Evaluated ${runs.length} examples`);
  console.log(
    `  ${passCount} passed (${((passCount / runs.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `  ${failCount} failed (${((failCount / runs.length) * 100).toFixed(1)}%)`
  );

  // Get base URL from client config
  const baseUrl = client.config.baseUrl || "http://localhost:6006";
  console.log(
    `\n→ View details: ${baseUrl}/datasets/${datasetId}/compare?experimentId=${experiment.id}\n`
  );
}

main().catch((error) => {
  console.error("Evaluation failed:", error);
  process.exit(1);
});
