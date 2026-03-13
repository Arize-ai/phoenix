/* eslint-disable no-console */
/**
 * Script 1 of 2: Create the initial dataset.
 *
 * Creates a dataset with 6 trivia examples — some with external IDs, some without.
 * Pass the dataset name as a CLI argument so the companion script
 * (fetch_and_mutate_dataset.ts) can retrieve and mutate it.
 *
 * Usage:
 *    npx tsx create_initial_dataset.ts my-dataset-name
 */

import { createClient } from "../src";
import { getDatasetExamples } from "../src/datasets/getDatasetExamples";
import { upsertDatasetExamples } from "../src/datasets/upsertDatasetExamples";
import type { Example } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";

async function main() {
  const datasetName = process.argv[2];
  if (!datasetName) {
    console.log("Usage: npx tsx create_initial_dataset.ts <dataset-name>");
    process.exit(1);
  }

  const client = createClient({ options: { baseUrl: PHOENIX_BASE_URL } });

  const v1Examples: Example[] = [
    // --- Examples WITH external IDs ---
    {
      input: { question: "What is the capital of France?" },
      output: { answer: "Paris" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-france",
    },
    {
      input: { question: "What is the capital of Germany?" },
      output: { answer: "Munich" }, // intentionally wrong — will be fixed later
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-germany",
    },
    {
      input: { question: "What is the capital of Japan?" },
      output: { answer: "Tokyo" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-japan",
    },
    // --- Examples WITHOUT external IDs (matched by content hash) ---
    {
      input: { question: "What is the largest ocean?" },
      output: { answer: "Pacific Ocean" },
      metadata: { category: "geography", difficulty: "easy" },
    },
    {
      input: { question: "What is the fastest land animal?" },
      output: { answer: "Cheetah" },
      metadata: { category: "biology", difficulty: "easy" },
    },
    {
      input: { question: "What is the boiling point of water?" },
      output: { answer: "100°C at standard atmospheric pressure" },
      metadata: { category: "science", difficulty: "easy" },
    },
  ];

  console.log("=".repeat(60));
  console.log(`Creating initial dataset: ${datasetName}`);
  console.log("=".repeat(60));

  const { datasetId, versionId } = await upsertDatasetExamples({
    client,
    dataset: { datasetName },
    description: "Trivia Q&A dataset for retrieve-mutate-upsert demo",
    examples: v1Examples,
  });

  console.log(`Dataset ID: ${datasetId}`);
  console.log(`Version ID: ${versionId}`);

  const { examples: retrievedExamples } = await getDatasetExamples({
    client,
    dataset: { datasetName },
  });

  console.log(`Examples: ${retrievedExamples.length}`);
  console.log("\nRetrieved examples:");
  for (const ex of retrievedExamples) {
    const extId = ex.externalId ?? null;
    const question = ex.input.question as string;
    console.log(
      `  externalId=${String(extId).padEnd(20)}  question=${JSON.stringify(question)}`
    );
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
