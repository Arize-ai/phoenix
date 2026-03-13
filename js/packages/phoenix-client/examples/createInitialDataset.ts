/**
 * Script 1 of 2: Create the initial dataset.
 *
 * Creates a dataset with 6 trivia examples — some with external IDs, some without.
 * Pass the dataset name as a CLI argument so the companion script
 * (fetchAndUpsertDataset.ts) can retrieve and mutate it.
 *
 * Usage:
 *    npx tsx createInitialDataset.ts my-dataset-name
 */

import { createClient } from "../src";
import { createDataset } from "../src/datasets/createDataset";
import { getDatasetExamples } from "../src/datasets/getDatasetExamples";
import type { Example } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";

async function main() {
  const datasetName = process.argv[2];
  if (!datasetName) {
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

  await createDataset({
    client,
    name: datasetName,
    description: "Trivia Q&A dataset for retrieve-mutate-upsert demo",
    examples: v1Examples,
  });

  await getDatasetExamples({
    client,
    dataset: { datasetName },
  });
}

main().catch(() => {
  process.exit(1);
});
