import { createClient } from "../src";
import { upsertDataset, type UpsertDatasetResponse } from "../src/datasets";
import { runExperiment } from "../src/experiments";
import type { Example } from "../src/types/datasets";

/* eslint-disable no-console */
import "dotenv/config";

const DEFAULT_DATASET_NAME = "support-benchmark";

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

const examplesV2: Example[] = [
  {
    input: { question: "What is AI?" },
    output: { answer: "Artificial Intelligence" },
    metadata: {},
  },
  {
    input: { question: "What is RL?" },
    output: { answer: "..." },
    metadata: {},
  },
];

type SmokeExperiment = {
  experimentId: string;
  runCount: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const smokeRun = args.includes("--smoke-run");
  const datasetNameArg = args.find((arg) => arg.startsWith("--dataset-name="));
  const datasetName = datasetNameArg
    ? datasetNameArg.slice("--dataset-name=".length)
    : DEFAULT_DATASET_NAME;
  return { smokeRun, datasetName };
}

function printUpsertEvent({
  label,
  upsert,
}: {
  label: string;
  upsert: Pick<UpsertDatasetResponse, "datasetId" | "versionId" | "summary">;
}) {
  console.log(
    `[${label}] dataset_id=${upsert.datasetId} version_id=${upsert.versionId} summary=${JSON.stringify(upsert.summary ?? {})}`
  );
}

function printExperimentEvent({
  label,
  experimentName,
  experiment,
  datasetVersionId,
}: {
  label: string;
  experimentName: string;
  experiment: SmokeExperiment;
  datasetVersionId: string;
}) {
  console.log(
    `[${label}] experiment_name=${experimentName} experiment_id=${experiment.experimentId} dataset_version_id=${datasetVersionId} run_count=${experiment.runCount}`
  );
}

async function runSmoke() {
  const upsertV1: UpsertDatasetResponse = {
    datasetId: "dataset-smoke-1",
    versionId: "version-smoke-1",
    summary: { added: 2, updated: 0, deleted: 0, unchanged: 0 },
  };
  const expV1: SmokeExperiment = {
    experimentId: "experiment-smoke-1",
    runCount: 2,
  };

  const upsertV2: UpsertDatasetResponse = {
    datasetId: upsertV1.datasetId,
    versionId: "version-smoke-2",
    summary: { added: 1, updated: 1, deleted: 1, unchanged: 0 },
  };
  const expV2: SmokeExperiment = {
    experimentId: "experiment-smoke-2",
    runCount: 2,
  };

  printUpsertEvent({ label: "upsert:v1", upsert: upsertV1 });
  printExperimentEvent({
    label: "experiment:v1",
    experimentName: "support-v1",
    experiment: expV1,
    datasetVersionId: upsertV1.versionId,
  });

  printUpsertEvent({ label: "upsert:v2", upsert: upsertV2 });
  printExperimentEvent({
    label: "experiment:v2",
    experimentName: "support-v2",
    experiment: expV2,
    datasetVersionId: upsertV2.versionId,
  });

  console.log(
    "Note: with hash-only mirror semantics, a content edit is represented as DELETE(old hash) + CREATE(new hash)."
  );
}

async function runLive({ datasetName }: { datasetName: string }) {
  const client = createClient();

  const upsertV1 = await upsertDataset({
    client,
    dataset: { datasetName },
    examples: examplesV1,
  });
  printUpsertEvent({ label: "upsert:v1", upsert: upsertV1 });

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
  printExperimentEvent({
    label: "experiment:v1",
    experimentName: "support-v1",
    experiment: {
      experimentId: expV1.id,
      runCount: Object.keys(expV1.runs).length,
    },
    datasetVersionId: upsertV1.versionId,
  });

  const upsertV2 = await upsertDataset({
    client,
    dataset: { datasetName },
    examples: examplesV2,
  });
  printUpsertEvent({ label: "upsert:v2", upsert: upsertV2 });

  const expV2 = await runExperiment({
    client,
    experimentName: "support-v2",
    dataset: { datasetId: upsertV2.datasetId, versionId: upsertV2.versionId },
    task,
    dryRun: true,
  });
  printExperimentEvent({
    label: "experiment:v2",
    experimentName: "support-v2",
    experiment: {
      experimentId: expV2.id,
      runCount: Object.keys(expV2.runs).length,
    },
    datasetVersionId: upsertV2.versionId,
  });

  console.log(
    "Note: with hash-only mirror semantics, a content edit is represented as DELETE(old hash) + CREATE(new hash)."
  );
}

async function main() {
  const { smokeRun, datasetName } = parseArgs();

  if (smokeRun) {
    await runSmoke();
    return;
  }

  await runLive({ datasetName });
}

main().catch((error: unknown) => {
  console.error("Failed to run upsert + experiment example", error);
  process.exit(1);
});
