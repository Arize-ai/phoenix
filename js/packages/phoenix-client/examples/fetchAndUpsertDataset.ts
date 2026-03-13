/**
 * Script 2 of 2: Fetch an existing dataset, mutate it, and upsert a new version.
 *
 * Retrieves the dataset created by createInitialDataset.ts, then:
 *   - Deletes "capital-france" and "largest ocean"
 *   - Patches "capital-germany" (fixes the answer to Berlin)
 *   - Mutates metadata on "fastest land animal" (different content hash → delete + re-create)
 *   - Adds "capital-italy" and "largest planet"
 *
 * Usage:
 *    npx tsx fetchAndUpsertDataset.ts my-dataset-name
 */

import { createClient } from "../src";
import { getDatasetExamples } from "../src/datasets/getDatasetExamples";
import { upsertDatasetExamples } from "../src/datasets/upsertDatasetExamples";
import { asEvaluator, runExperiment } from "../src/experiments";
import type { AnnotatorKind } from "../src/types/annotations";
import type { Example } from "../src/types/datasets";

const PHOENIX_BASE_URL = "http://localhost:6006";

async function main() {
  const datasetName = process.argv[2];
  if (!datasetName) {
    process.exit(1);
  }

  const client = createClient({ options: { baseUrl: PHOENIX_BASE_URL } });

  // =========================================================================
  // Retrieve existing dataset
  // =========================================================================

  const { examples: retrieved, versionId } = await getDatasetExamples({
    client,
    dataset: { datasetName },
  });

  // =========================================================================
  // Shared task and evaluator definitions
  // =========================================================================

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

  // =========================================================================
  // Experiment 1: Run against retrieved dataset (version 1)
  // =========================================================================

  await runExperiment({
    client,
    dataset: { datasetName, versionId },
    task,
    evaluators: [exactMatch],
    experimentName: `trivia-v1-${Date.now()}`,
    experimentDescription: "Experiment against initial dataset version",
  });

  // =========================================================================
  // Mutate the retrieved examples
  // =========================================================================

  // DELETE "capital-france" and "largest ocean" by filtering them out.
  const v2Examples: Example[] = retrieved
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

  // =========================================================================
  // Upsert mutated examples as a new version
  // =========================================================================

  const { versionId: v2VersionId } = await upsertDatasetExamples({
    client,
    dataset: { datasetName },
    description: "Trivia Q&A dataset for retrieve-mutate-upsert demo",
    examples: v2Examples,
  });

  await getDatasetExamples({
    client,
    dataset: { datasetName },
  });

  // =========================================================================
  // Experiment 2: Run against version 2
  // =========================================================================

  await runExperiment({
    client,
    dataset: { datasetName, versionId: v2VersionId },
    task,
    evaluators: [exactMatch],
    experimentName: `trivia-v2-${Date.now()}`,
    experimentDescription: "Experiment against updated dataset version",
  });
}

main().catch(() => {
  process.exit(1);
});
