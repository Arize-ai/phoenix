/**
 * Example: Upsert a dataset, run an experiment, upsert again, and re-run the experiment.
 *
 * Demonstrates the full lifecycle of dataset upsert semantics:
 * - Creating examples with and without external IDs
 * - Deleting, patching, carrying over, and adding examples across versions
 * - Running experiments against each dataset version
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
 *   Version 2 (second upsert):
 *     - "capital-germany"  (externalId) — PATCHED (answer corrected)
 *     - "capital-japan"    (externalId) — UNCHANGED (same content)
 *     - "capital-italy"    (externalId) — NEW example
 *     - no externalId, content: "fastest land animal" now has updated metadata — DELETED + RE-CREATED
 *     - no externalId, content: "boiling point of water" — UNCHANGED (same content)
 *     - no externalId, content: "largest planet" — NEW example
 *
 * Prerequisites:
 *     - Phoenix server running (default: http://localhost:6006)
 *
 * Usage:
 *     npx tsx datasetUpsertRoundTripWithExperiments.ts
 */

import { createClient } from "../src";
import { getDatasetExamples } from "../src/datasets/getDatasetExamples";
import { upsertDatasetExamples } from "../src/datasets/upsertDatasetExamples";
import { asExperimentEvaluator, runExperiment } from "../src/experiments";
import type { AnnotatorKind } from "../src/types/annotations";
import type { Example } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";
const DATASET_NAME = `upsert-demo-${Date.now()}`;

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
    description: "Trivia Q&A dataset for upsert demo",
    examples: v1Examples,
  });

  await getDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
  });

  // ===========================================================================
  // Experiment 1: Run against version 1
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

  const exactMatch = asExperimentEvaluator({
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

  // ===========================================================================
  // Version 2: Upsert with changes
  // ===========================================================================

  const v2Examples: Example[] = [
    // --- Examples WITH external IDs ---
    // "capital-france" is OMITTED → will be DELETED
    {
      // PATCHED: answer corrected from "Munich" to "Berlin"
      input: { question: "What is the capital of Germany?" },
      output: { answer: "Berlin" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-germany",
    },
    {
      // UNCHANGED: identical to v1
      input: { question: "What is the capital of Japan?" },
      output: { answer: "Tokyo" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-japan",
    },
    {
      // NEW: did not exist in v1
      input: { question: "What is the capital of Italy?" },
      output: { answer: "Rome" },
      metadata: { category: "geography", difficulty: "easy" },
      externalId: "capital-italy",
    },
    // --- Examples WITHOUT external IDs ---
    // "largest ocean" is OMITTED → will be DELETED
    {
      // NEW: same question but metadata changed → different content hash → new example
      input: { question: "What is the fastest land animal?" },
      output: { answer: "Cheetah" },
      metadata: {
        category: "biology",
        difficulty: "easy",
        fun_fact: "Up to 70 mph",
      },
    },
    {
      // UNCHANGED: identical to v1 → same content hash
      input: { question: "What is the boiling point of water?" },
      output: { answer: "100°C at standard atmospheric pressure" },
      metadata: { category: "science", difficulty: "easy" },
    },
    {
      // NEW: did not exist in v1
      input: { question: "What is the largest planet in our solar system?" },
      output: { answer: "Jupiter" },
      metadata: { category: "astronomy", difficulty: "easy" },
    },
  ];

  const { versionId: v2VersionId } = await upsertDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
    description: "Trivia Q&A dataset for upsert demo",
    examples: v2Examples,
  });

  await getDatasetExamples({
    client,
    dataset: { datasetName: DATASET_NAME },
  });

  // ===========================================================================
  // Experiment 2: Run against version 2
  // ===========================================================================

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
