/**
 * Language detection benchmark on candradhipa/Language-Detection.
 *
 * 10 passages each for English, French, Spanish, and Hindi, plus 10 passages
 * from languages outside that set (expected label: other). Mandarin Chinese
 * is not in the source dataset.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as px from "@arizeai/phoenix-client/vitest";
import { createLanguageDetectionEvaluator } from "@arizeai/phoenix-evals";
import { afterAll } from "vitest";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

type LanguageLabel =
  | "english"
  | "mandarin_chinese"
  | "hindi"
  | "spanish"
  | "french"
  | "other";

interface DatasetExample {
  id: string;
  source_language: string;
  expected_label: LanguageLabel;
  session: string;
}

interface DatasetFile {
  examples: DatasetExample[];
}

const datasetPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data/language_detection_candradhipa.json"
);
const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as DatasetFile;

const labels = createLabelAccumulator();
const languageDetectionEvaluator = createLanguageDetectionEvaluator({
  model: evalModel,
});

const cases = dataset.examples.map((example) => ({
  input: { session: example.session },
  expected: { label: example.expected_label },
  metadata: {
    category: example.expected_label,
    id: example.id,
    sourceLanguage: example.source_language,
  },
  splits: [example.expected_label],
}));

const results: {
  category: string;
  id: string;
  session: string;
  expected: string;
  actual: string | undefined;
  explanation: string | undefined;
}[] = [];

px.describe(
  "language-detection-candradhipa",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${String(row.metadata?.id)}`,
      async ({ input, expected, metadata }) => {
        const result = await languageDetectionEvaluator.evaluate({
          session: input.session,
        });
        px.logOutput(result);
        px.logAnnotation({
          name: "language_detection",
          label: result.label,
          score: result.score,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        recordPrediction({
          labels,
          truth: expected?.label,
          predicted: result.label,
        });
        results.push({
          category: String(metadata?.category),
          id: String(metadata?.id),
          session: input.session,
          expected: String(expected?.label),
          actual: result.label,
          explanation: result.explanation,
        });
        await px.evaluate(accuracy);
      }
    );
    registerAggregateMetricsTest(labels);
  },
  {
    description:
      "Language detection on 50 passages from candradhipa/Language-Detection: English, French, Spanish, Hindi, and ten other languages.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);

afterAll(() => {
  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const result of results) {
    const stats = byCategory.get(result.category) ?? { correct: 0, total: 0 };
    stats.total += 1;
    if (result.actual === result.expected) {
      stats.correct += 1;
    }
    byCategory.set(result.category, stats);
  }
  // eslint-disable-next-line no-console
  console.log("\nlanguage detection candradhipa: per-label accuracy");
  for (const [category, stats] of byCategory) {
    // eslint-disable-next-line no-console
    console.log(`  ${category}: ${stats.correct}/${stats.total}`);
  }
  const failures = results.filter(
    (result) => result.actual !== result.expected
  );
  if (failures.length === 0) {
    // eslint-disable-next-line no-console
    console.log("\n✓ no misclassified cases\n");
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`\n✗ ${failures.length} misclassified case(s)`);
  for (const failure of failures) {
    const preview = failure.session.replace(/\s+/g, " ").slice(0, 240);
    // eslint-disable-next-line no-console
    console.log(
      `\n[${failure.category}] ${failure.id} expected=${failure.expected} actual=${failure.actual}\n  session: ${preview}\n  judge: ${failure.explanation ?? "(no explanation)"}`
    );
  }
  // eslint-disable-next-line no-console
  console.log("");
});
