import { createClient } from "../src";
import { upsertDataset } from "../src/datasets";
import { runExperiment } from "../src/experiments";
import type { Example } from "../src/types/datasets";

/* eslint-disable no-console */
import "dotenv/config";

const DATASET_NAME = "support-benchmark";

const examplesV1: Example[] = [
  {
    input: { question: "What is AI?" },
    output: { answer: "..." },
    metadata: {},
  },
  {
    input: { question: "What is ML?" },
    output: { answer: "..." },
    metadata: {},
  },
];

// V2: keep "What is AI?" unchanged, delete "What is ML?", add "What is RL?"
const examplesV2: Example[] = [
  {
    input: { question: "What is AI?" },
    output: { answer: "..." },
    metadata: {},
  },
  {
    input: { question: "What is RL?" },
    output: { answer: "..." },
    metadata: {},
  },
];

async function main() {
  const client = createClient();

  const upsertV1 = await upsertDataset({
    client,
    dataset: { datasetName: DATASET_NAME },
    examples: examplesV1,
  });
  console.log(
    `[upsert:v1] dataset_id=${upsertV1.datasetId} version_id=${upsertV1.versionId} summary=${JSON.stringify(upsertV1.summary ?? {})}`
  );

  const task = async (example: Example) => {
    const input = example.input as { question?: string };
    return { answer: `stub: ${input.question ?? ""}` };
  };

  const expV1 = await runExperiment({
    client,
    experimentName: "support-v1",
    dataset: { datasetId: upsertV1.datasetId, versionId: upsertV1.versionId },
    task,
    dryRun: true,
  });
  console.log(
    `[experiment:v1] experiment_id=${expV1.id} dataset_version_id=${upsertV1.versionId} run_count=${Object.keys(expV1.runs).length}`
  );

  const upsertV2 = await upsertDataset({
    client,
    dataset: { datasetName: DATASET_NAME },
    examples: examplesV2,
  });
  console.log(
    `[upsert:v2] dataset_id=${upsertV2.datasetId} version_id=${upsertV2.versionId} summary=${JSON.stringify(upsertV2.summary ?? {})}`
  );

  const expV2 = await runExperiment({
    client,
    experimentName: "support-v2",
    dataset: { datasetId: upsertV2.datasetId, versionId: upsertV2.versionId },
    task,
    dryRun: true,
  });
  console.log(
    `[experiment:v2] experiment_id=${expV2.id} dataset_version_id=${upsertV2.versionId} run_count=${Object.keys(expV2.runs).length}`
  );
}

main().catch((error: unknown) => {
  console.error("Failed to run upsert + experiment example", error);
  process.exit(1);
});
