/* eslint-disable no-console */
/**
 * Smoke test the full dataset upsert/update functionality (TypeScript).
 *
 * Three-step flow via `createDataset` (which sends `action=update` under the
 * hood) using the per-example `id` field for stable identity matching:
 *
 *   1. seed        - 4 examples (a, b, c, d) -> new version, 4 examples
 *   2. idempotence - re-send same payload    -> same versionId, no-op
 *   3. modify      - patch a (A -> A'), drop b, move c's split, keep d, add e
 *                    -> new version, 4 examples
 *                    -> because each example carries an `id`, the diff
 *                       classifies a as a PATCH revision (not delete+create),
 *                       b as DELETE, e as CREATE, and c as a splits-only
 *                       change (no new revision row)
 *
 * Run:
 *   pnpm --dir js --filter @arizeai/phoenix-client exec tsx ../../../scripts/testing/dataset_upsert_smoke.ts
 *
 * Set PHOENIX_HOST (for example http://localhost:6148) and/or PHOENIX_API_KEY
 * if your server is not on the default http://localhost:6006 with no auth.
 */

import { createClient } from "../../js/packages/phoenix-client/src/client";
import {
  createDataset,
  getDataset,
} from "../../js/packages/phoenix-client/src/datasets";
import { runExperiment } from "../../js/packages/phoenix-client/src/experiments";
import type {
  Dataset,
  Example,
} from "../../js/packages/phoenix-client/src/types/datasets";

type SmokeExample = Example & { id: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runExperimentAndAssert({
  dataset,
  label,
  expectedOutputs,
}: {
  dataset: Dataset;
  label: string;
  expectedOutputs: Set<string>;
}) {
  const experiment = await runExperiment({
    client,
    dataset: { datasetId: dataset.id, versionId: dataset.versionId },
    experimentName: `${dataset.name}-${label}-experiment`,
    task: async (example) => String(example.input.v),
    logger: console,
  });
  const taskRuns = Object.values(experiment.runs);
  const actualOutputs = new Set(taskRuns.map((taskRun) => String(taskRun.output)));

  console.log(
    [
      `${label} experiment:`,
      `experiment_id=${experiment.id}`,
      `version=${dataset.versionId}`,
      `runs=${taskRuns.length}`,
    ].join(" ")
  );

  assert(
    taskRuns.length === dataset.examples.length,
    `expected ${dataset.examples.length} task runs, got ${taskRuns.length}`
  );
  assert(
    (experiment.evaluationRuns?.length ?? 0) === 0,
    `expected no evaluation runs, got ${experiment.evaluationRuns?.length ?? 0}`
  );
  assert(
    actualOutputs.size === expectedOutputs.size &&
      [...expectedOutputs].every((expectedOutput) => actualOutputs.has(expectedOutput)),
    `expected experiment outputs ${JSON.stringify(
      [...expectedOutputs]
    )}, got ${JSON.stringify([...actualOutputs])}`
  );
}

async function main() {
  const name = `upsert-smoke-ts-${Date.now()}`;
  const description = "Smoke test for dataset upsert semantics";

  const seed: SmokeExample[] = [
    { id: "a", input: { v: "A" }, output: {}, splits: "s1" },
    { id: "b", input: { v: "B" }, output: {}, splits: "s1" },
    { id: "c", input: { v: "C" }, output: {}, splits: "s2" },
    { id: "d", input: { v: "D" }, output: {}, splits: "s2" },
  ];

  const step1 = await createDataset({
    client,
    name,
    description,
    examples: seed,
  });
  const dataset1 = await getDataset({
    client,
    dataset: { datasetId: step1.datasetId },
  });
  console.log(`step 1 seed         : version=${dataset1.versionId}  n=${dataset1.examples.length}`);
  assert(dataset1.examples.length === 4, `expected 4 examples, got ${dataset1.examples.length}`);
  await runExperimentAndAssert({
    dataset: dataset1,
    label: "step-1-seed",
    expectedOutputs: new Set(["A", "B", "C", "D"]),
  });

  const step2 = await createDataset({
    client,
    name,
    description,
    examples: seed,
  });
  const dataset2 = await getDataset({
    client,
    dataset: { datasetId: step2.datasetId },
  });
  console.log(`step 2 idempotence  : version=${dataset2.versionId}  n=${dataset2.examples.length}`);
  assert(
    dataset2.versionId === dataset1.versionId,
    `expected no new version, got ${dataset1.versionId} -> ${dataset2.versionId}`
  );
  assert(dataset2.examples.length === 4, `expected 4 examples, got ${dataset2.examples.length}`);
  await runExperimentAndAssert({
    dataset: dataset2,
    label: "step-2-idempotence",
    expectedOutputs: new Set(["A", "B", "C", "D"]),
  });

  const modified: SmokeExample[] = [
    { id: "a", input: { v: "A'" }, output: {}, splits: "s1" },
    { id: "c", input: { v: "C" }, output: {}, splits: "s1" },
    { id: "d", input: { v: "D" }, output: {}, splits: "s2" },
    { id: "e", input: { v: "E" }, output: {}, splits: "s1" },
  ];

  const step3 = await createDataset({
    client,
    name,
    description,
    examples: modified,
  });
  const dataset3 = await getDataset({
    client,
    dataset: { datasetId: step3.datasetId },
  });
  console.log(`step 3 modify       : version=${dataset3.versionId}  n=${dataset3.examples.length}`);
  assert(
    dataset3.versionId !== dataset1.versionId,
    `expected new version, got ${dataset1.versionId}`
  );
  assert(dataset3.examples.length === 4, `expected 4 examples, got ${dataset3.examples.length}`);
  await runExperimentAndAssert({
    dataset: dataset3,
    label: "step-3-modify",
    expectedOutputs: new Set(["A'", "C", "D", "E"]),
  });

  const currentInputs = dataset3.examples.map((example) => example.input);
  const hasPatchedExample = currentInputs.some((input) => input.v === "A'");
  const hasNewExample = currentInputs.some((input) => input.v === "E");
  const hasDeletedExample = currentInputs.some((input) => input.v === "B");
  assert(hasPatchedExample, "expected patched example A' in latest dataset");
  assert(hasNewExample, "expected new example E in latest dataset");
  assert(!hasDeletedExample, "did not expect deleted example B in latest dataset");

  const s1After = await getDataset({
    client,
    dataset: { datasetName: name, splits: ["s1"] },
  });
  const s1Inputs = s1After.examples.map((example) => example.input);
  const hasMovedExample = s1Inputs.some((input) => input.v === "C");
  assert(
    hasMovedExample,
    `expected example c (input {"v":"C"}) to be in split s1; got ${JSON.stringify(s1Inputs)}`
  );

  console.log(`OK - full upsert flow verified (dataset ${JSON.stringify(name)})`);
}

const client = createClient();

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
