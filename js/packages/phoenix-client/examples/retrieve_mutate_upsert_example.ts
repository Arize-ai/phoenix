/**
 * Example: Retrieve examples from a dataset, mutate them, and upsert.
 *
 * Demonstrates the round-trip workflow:
 * 1. Upsert an initial dataset
 * 2. Retrieve the returned examples (which now include externalId)
 * 3. Mutate the list — patch, delete, add — using the retrieved examples directly
 * 4. Upsert the mutated list as a new version
 *
 * The dataset has two versions:
 *
 *   Version 1 (initial upsert):
 *     1. "capital-france"   (externalId) — will be DELETED in v2
 *     2. "capital-germany"  (externalId) — will be PATCHED in v2
 *     3. "capital-japan"    (externalId) — will be UNCHANGED in v2
 *     4. no externalId, content: "largest ocean" — will be DELETED in v2
 *     5. no externalId, content: "fastest land animal" — will be DELETED and RE-CREATED in v2
 *        (metadata change → different content hash → not matchable, so old is deleted, new is created)
 *     6. no externalId, content: "boiling point of water" — will be UNCHANGED in v2
 *
 *   Version 2 (mutated from v1 examples):
 *     - "capital-germany"  — PATCHED (answer corrected)
 *     - "capital-japan"    — UNCHANGED (same content)
 *     - "capital-italy"    — NEW example added to the list
 *     - "fastest land animal" now has updated metadata — DELETED + RE-CREATED
 *     - "boiling point of water" — UNCHANGED (same content)
 *     - "largest planet"   — NEW example added to the list
 *
 * Prerequisites:
 *     - Phoenix server running (default: http://localhost:6006)
 *
 * Usage:
 *     npx tsx retrieve_mutate_upsert_example.ts
 */

import { createClient } from "../src";
import { getDatasetExamples } from "../src/datasets/getDatasetExamples";
import { upsertDatasetExamples } from "../src/datasets/upsertDatasetExamples";
import { asEvaluator, runExperiment } from "../src/experiments";
import type { AnnotatorKind } from "../src/types/annotations";
import type { Example } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";
const DATASET_NAME = `retrieve-mutate-demo-${Date.now()}`;

const client = createClient({ options: { baseUrl: PHOENIX_BASE_URL } });

async function main() {
  // ===========================================================================
  // Version 1: Initial dataset upsert
  // ===========================================================================

  const v1Examples: Example[] = [
    // --- Examples WITH external IDs ---
    {
      // Will be DELETED in v2 (absent from next upsert)
      input: { question: "What is the capital of France?" },
      output: { answer: "Paris" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-france",
    },
    {
      // Will be PATCHED in v2 (answer corrected)
      input: { question: "What is the capital of Germany?" },
      output: { answer: "Munich" }, // intentionally wrong — will be fixed in v2
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-germany",
    },
    {
      // Will be UNCHANGED in v2 (same content)
      input: { question: "What is the capital of Japan?" },
      output: { answer: "Tokyo" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-japan",
    },
    // --- Examples WITHOUT external IDs (matched by content hash) ---
    {
      // Will be DELETED in v2 (absent from next upsert)
      input: { question: "What is the largest ocean?" },
      output: { answer: "Pacific Ocean" },
      metadata: { category: "geography", difficulty: "easy" },
    },
    {
      // Will be DELETED and RE-CREATED in v2
      // (metadata change → different content hash → unmatchable)
      input: { question: "What is the fastest land animal?" },
      output: { answer: "Cheetah" },
      metadata: { category: "biology", difficulty: "easy" },
    },
    {
      // Will be UNCHANGED in v2 (identical content → same content hash)
      input: { question: "What is the boiling point of water?" },
      output: { answer: "100°C at standard atmospheric pressure" },
      metadata: { category: "science", difficulty: "easy" },
    },
  ];

  const { datasetId, versionId: v1VersionId } = await upsertDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
    description: "Trivia Q&A dataset for retrieve-mutate-upsert demo",
    examples: v1Examples,
  });

  const { examples: v1Retrieved } = await getDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
  });

  // ===========================================================================
  // Version 2: Mutate the retrieved list and upsert again
  // ===========================================================================

  // DELETE "capital-france" and "largest ocean" by filtering them out.
  const v2Examples: Example[] = v1Retrieved
    .filter(
      (orig) =>
        orig.externalId !== "capital-france" &&
        (orig.input.question as string) !== "What is the largest ocean?"
    )
    .map((orig) => {
      const example: Example = {
        input: { ...orig.input },
        output: orig.output ? { ...orig.output } : {},
        metadata: orig.metadata ? { ...orig.metadata } : {},
        externalId: orig.externalId,
      };

      // PATCH: fix the answer for "capital-germany"
      if (example.externalId === "capital-germany") {
        example.output = { answer: "Berlin" };
      }
      // MUTATE metadata on "fastest land animal" → different content hash → delete + re-create
      if (
        (example.input.question as string) ===
        "What is the fastest land animal?"
      ) {
        example.metadata = {
          category: "biology",
          difficulty: "easy",
          fun_fact: "Up to 70 mph",
        };
      }

      return example;
    });

  // ADD: new examples
  v2Examples.push({
    input: { question: "What is the capital of Italy?" },
    output: { answer: "Rome" },
    metadata: { category: "geography", difficulty: "easy" },
    externalId: "capital-italy",
  });
  v2Examples.push({
    input: { question: "What is the largest planet in our solar system?" },
    output: { answer: "Jupiter" },
    metadata: { category: "astronomy", difficulty: "easy" },
  });

  const { versionId: v2VersionId } = await upsertDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
    description: "Trivia Q&A dataset for retrieve-mutate-upsert demo",
    examples: v2Examples,
  });

  await getDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
  });

  // ===========================================================================
  // Experiment: Run against both versions
  // ===========================================================================

  const triviaAnswers: Record<string, string> = {
    "What is the capital of France?": "Paris",
    "What is the capital of Germany?": "Berlin",
    "What is the capital of Japan?": "Tokyo",
    "What is the capital of Italy?": "Rome",
    "What is the largest ocean?": "Pacific Ocean",
    "What is the fastest land animal?": "Cheetah",
    "What is the boiling point of water?":
      "100°C at standard atmospheric pressure",
    "What is the largest planet in our solar system?": "Jupiter",
  };

  const task = (example: Example) => {
    const question = example.input.question as string;
    return triviaAnswers[question] ?? "I don't know";
  };

  const exactMatch = asEvaluator({
    name: "exact_match",
    kind: "CODE" as AnnotatorKind,
    evaluate: async ({ output, expected }) => {
      const matches = output === (expected?.answer as string);
      return {
        score: matches ? 1.0 : 0.0,
        label: matches ? "correct" : "incorrect",
        metadata: {},
        explanation: matches
          ? "Output matches expected answer"
          : "Output does not match expected answer",
      };
    },
  });

  await runExperiment({
    client,
    dataset: { datasetId, versionId: v1VersionId },
    task,
    evaluators: [exactMatch],
    experimentName: `trivia-v1-${Date.now()}`,
    experimentDescription: "Experiment against initial dataset version",
  });

  await runExperiment({
    client,
    dataset: { datasetId, versionId: v2VersionId },
    task,
    evaluators: [exactMatch],
    experimentName: `trivia-v2-${Date.now()}`,
    experimentDescription: "Experiment against updated dataset version",
  });
}

main().catch(() => {
  process.exit(1);
});
