/* eslint-disable no-console */
/**
 * Dataset upsert with experiments — iterative evaluation workflow (TypeScript).
 *
 * Demonstrates:
 *  1. Create a dataset with stable example IDs (v1 — 4 examples, one intentionally wrong)
 *  2. Run an experiment on v1
 *  3. Upsert the dataset — fix the wrong answer, add 2 new examples, remove 1 (v2 — 5 examples)
 *  4. Run a second experiment on v2
 *  5. Print a summary
 *
 * Prerequisites:
 *   Phoenix running at http://localhost:6006
 *
 * Usage:
 *   pnpm tsx js/packages/phoenix-client/examples/dataset_upsert_roundtrip.ts
 */

import { createClient } from "../src/client";
import { createDataset } from "../src/datasets/createDataset";
import { getDataset } from "../src/datasets/getDataset";
import { asExperimentEvaluator, runExperiment } from "../src/experiments";
import type { ExampleWithId } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";
const DATASET_NAME = `qa-eval-ts-${Date.now()}`;

const client = createClient({ baseUrl: PHOENIX_BASE_URL });

// Simulated "correct" answers — the task looks answers up here.
const SIMULATED_ANSWERS: Record<string, string> = {
  "What is the capital of Japan?": "Tokyo",
  "What is the capital of Germany?": "Berlin",
  "What is the capital of France?": "Paris",
  "What is the boiling point of water in Celsius?": "100",
  "What is the speed of light in m/s?": "299792458",
  "What is the largest planet in our solar system?": "Jupiter",
};

function qaTask(example: ExampleWithId): Record<string, string> {
  const question = example.input["question"] as string;
  const answer = SIMULATED_ANSWERS[question] ?? "I don't know";
  return { answer };
}

const exactMatch = asExperimentEvaluator({
  name: "exact_match",
  kind: "CODE",
  evaluate: async ({ output, expected }) => {
    const out = String((output as Record<string, unknown>)?.answer ?? "")
      .trim()
      .toLowerCase();
    const exp = String((expected as Record<string, unknown>)?.answer ?? "")
      .trim()
      .toLowerCase();
    const matches = out === exp;
    return {
      score: matches ? 1 : 0,
      label: matches ? "match" : "mismatch",
      explanation: matches ? "exact match" : `got "${out}", expected "${exp}"`,
      metadata: {},
    };
  },
});

async function main() {
  // ===========================================================================
  // Step 1: Create the initial dataset (v1 — 4 examples, Germany intentionally wrong)
  // ===========================================================================
  console.log("=".repeat(60));
  console.log("Step 1: Creating initial dataset (4 examples)");
  console.log("=".repeat(60));

  const { datasetId } = await createDataset({
    client,
    name: DATASET_NAME,
    description: "QA evaluation dataset — TS upsert roundtrip test",
    examples: [
      {
        input: { question: "What is the capital of Japan?" },
        output: { answer: "Tokyo" },
        metadata: { category: "geography", difficulty: "easy" },
        id: "capital-japan",
      },
      {
        input: { question: "What is the capital of Germany?" },
        output: { answer: "Munich" }, // intentionally wrong — will be fixed in v2
        metadata: { category: "geography", difficulty: "easy" },
        id: "capital-germany",
      },
      {
        input: { question: "What is the capital of France?" },
        output: { answer: "Paris" },
        metadata: { category: "geography", difficulty: "easy" },
        id: "capital-france",
      },
      {
        input: { question: "What is the boiling point of water in Celsius?" },
        output: { answer: "100" },
        metadata: { category: "science", difficulty: "easy" },
        id: "boiling-point",
      },
    ],
  });

  const datasetV1 = await getDataset({ client, dataset: { datasetId } });
  console.log(`  Dataset:  ${datasetV1.name}`);
  console.log(`  Version:  ${datasetV1.versionId}`);
  console.log(`  Examples: ${datasetV1.examples.length}`);

  // ===========================================================================
  // Step 2: Run experiment on v1
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("Step 2: Running experiment on v1 (simulated QA task)");
  console.log("=".repeat(60));

  const experimentV1 = await runExperiment({
    client,
    experimentName: "qa-v1",
    experimentDescription: "Baseline evaluation on v1 dataset",
    dataset: { datasetId },
    task: qaTask,
    evaluators: [exactMatch],
  });

  // Germany label is wrong ("Munich") but task returns "Berlin" → mismatch expected
  console.log(`  Experiment ID: ${experimentV1.id}`);
  console.log(`  Runs: ${Object.keys(experimentV1.runs).length}`);

  // ===========================================================================
  // Step 3: Upsert dataset — fix Germany, drop France, add 2 new (v2 — 5 examples)
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  console.log(
    "Step 3: Upserting dataset — fix Germany, add 2 new, remove France"
  );
  console.log("=".repeat(60));

  // Start from retrieved v1 examples so IDs round-trip correctly
  const v2Examples = datasetV1.examples
    .filter((ex) => ex.input["question"] !== "What is the capital of France?")
    .map((ex) => {
      if (ex.input["question"] === "What is the capital of Germany?") {
        return { ...ex, output: { answer: "Berlin" } };
      }
      return { ...ex };
    });

  // Add two new examples
  v2Examples.push({
    id: "speed-of-light",
    nodeId: "",
    updatedAt: new Date(),
    input: { question: "What is the speed of light in m/s?" },
    output: { answer: "299792458" },
    metadata: { category: "physics", difficulty: "medium" },
  });
  v2Examples.push({
    id: "largest-planet",
    nodeId: "",
    updatedAt: new Date(),
    input: { question: "What is the largest planet in our solar system?" },
    output: { answer: "Jupiter" },
    metadata: { category: "astronomy", difficulty: "easy" },
  });

  const { datasetId: datasetIdV2 } = await createDataset({
    client,
    name: DATASET_NAME,
    description: "QA evaluation dataset — TS upsert roundtrip test (v2)",
    examples: v2Examples,
  });

  const datasetV2 = await getDataset({
    client,
    dataset: { datasetId: datasetIdV2 },
  });

  console.log(`  Dataset:  ${datasetV2.name}`);
  console.log(`  Version:  ${datasetV2.versionId}`);
  console.log(`  Examples: ${datasetV2.examples.length}`);
  console.log("  Changes:  1 fix (Germany), 1 removal (France), 2 additions");

  if (datasetV2.versionId === datasetV1.versionId) {
    throw new Error("Expected a new dataset version after upsert");
  }
  console.log("  ✓ New version created");

  // ===========================================================================
  // Step 4: Run experiment on v2
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("Step 4: Running experiment on v2 (corrected dataset)");
  console.log("=".repeat(60));

  const experimentV2 = await runExperiment({
    client,
    experimentName: "qa-v2",
    experimentDescription: "Re-evaluation after dataset corrections",
    dataset: { datasetId: datasetIdV2 },
    task: qaTask,
    evaluators: [exactMatch],
  });

  console.log(`  Experiment ID: ${experimentV2.id}`);
  console.log(`  Runs: ${Object.keys(experimentV2.runs).length}`);

  // ===========================================================================
  // Step 5: Summary
  // ===========================================================================
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`  Dataset name: ${DATASET_NAME}`);
  console.log(`  Dataset ID:   ${datasetId}`);
  console.log(
    `  v1 version:   ${datasetV1.versionId}  (${datasetV1.examples.length} examples)`
  );
  console.log(
    `  v2 version:   ${datasetV2.versionId}  (${datasetV2.examples.length} examples)`
  );
  console.log(
    `  exp qa-v1 ID: ${experimentV1.id}  (${experimentV1.runs.length} runs)`
  );
  console.log(
    `  exp qa-v2 ID: ${experimentV2.id}  (${experimentV2.runs.length} runs)`
  );
  console.log();
  console.log(
    "  v1 had an incorrect label for Germany (Munich instead of Berlin),"
  );
  console.log(
    "  causing exact_match to fail. After the upsert in v2 all examples match."
  );
  console.log();
  console.log(`  View results at: ${PHOENIX_BASE_URL}/datasets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
