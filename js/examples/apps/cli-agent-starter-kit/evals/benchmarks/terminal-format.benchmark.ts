/**
 * Evaluator benchmark (meta-eval): how accurate is the judge itself?
 *
 * Read terminal-format.eval.ts FIRST — this file reuses the same Vitest +
 * Phoenix-reporter machinery (it's auto-discovered by `pnpm eval`; no runner
 * script), but answers a different question: can we trust the judge?
 *
 * An LLM judge can be wrong, so before relying on it we measure it against a
 * golden, hand-labeled dataset. That inverts the roles compared to the task eval:
 *   task eval  → task = agent,       evaluator = the judge
 *   benchmark  → task = the judge,   score      = exact-match vs ground truth
 *
 * The flow of one case:
 *   1. px.test.each(...)   — one golden example per row (a labeled response)
 *   2. judge.evaluate(...) — run the judge on that pre-labeled response
 *   3. px.logOutput(...)   — record the judge's predicted label
 *   4. px.logAnnotation()  — score exact-match against the golden label
 *   5. acceptanceCriteria  — gate accuracy; afterAll prints a TPR/TNR matrix
 *
 * Recorded under the *benchmark* dataset (see datasetName below) so its
 * experiment history stays separate from the agent task experiments in Phoenix.
 *
 * Run this suite:
 *   pnpm eval:benchmark   — just this file, recorded to Phoenix
 *   pnpm eval             — every eval + benchmark suite
 *   pnpm eval:offline     — run without recording (PHOENIX_TEST_TRACKING=false)
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { afterAll } from "vitest";

import { terminalFormatDataset } from "../datasets/index.js";
import { createTerminalSafeFormatEvaluator } from "../evaluators/index.js";
import {
  computeConfusionMatrix,
  printConfusionMatrix,
} from "../utils/index.js";
import type { LabelPair } from "../utils/index.js";

const COMPLIANT = "compliant";
const NON_COMPLIANT = "non_compliant";

// The judge under test — built once and reused across cases.
const judge = createTerminalSafeFormatEvaluator();

// Each golden example pairs a canned response with its ground-truth label.
const cases = terminalFormatDataset.examples.map((example, i) => ({
  id: `${(example.metadata?.category as string) ?? "case"}-${i}`,
  input: example.input as { prompt: string },
  // `output` is the ReferenceOutput slot — the golden response under test,
  // exposed to the test body as `expected`.
  output: example.output as { response: string },
  metadata: example.metadata ?? undefined,
}));

// Accumulate predictions to print a confusion matrix once the suite finishes.
const pairs: LabelPair[] = [];
afterAll(() => {
  if (pairs.length === 0) return;
  printConfusionMatrix(
    computeConfusionMatrix({
      evaluatorName: "terminal-safe-format",
      pairs,
      positiveLabel: COMPLIANT,
      negativeLabel: NON_COMPLIANT,
    })
  );
});

px.describe(
  "terminal-safe-format judge benchmark",
  () => {
    px.test.each(cases)(
      (row) => row.id ?? "case",
      async ({ expected, metadata }) => {
        const expectedLabel = metadata?.expectedSafe
          ? COMPLIANT
          : NON_COMPLIANT;
        const { response } = expected as { response: string };

        // Task under test: run the judge on the pre-labeled response.
        const { label: predicted = null } = await (
          await judge
        ).evaluate({
          output: response,
        });

        px.logOutput({ predicted, expected: expectedLabel });
        pairs.push({ predicted, actual: expectedLabel });

        // Score: exact match against the golden label.
        px.logAnnotation({
          name: "exact_match",
          score: predicted === expectedLabel ? 1 : 0,
          label: predicted ?? "unknown",
          annotatorKind: "CODE",
          explanation: `Expected: ${expectedLabel}, Got: ${predicted ?? "unknown"}`,
        });
      }
    );
  },
  {
    datasetName: terminalFormatDataset.benchmarkName,
    description: terminalFormatDataset.benchmarkDescription,
    acceptanceCriteria: [
      // A trustworthy judge agrees with the golden labels at least 80% of the time.
      {
        annotationName: "exact_match",
        metric: "passRate",
        passFn: (a) => a.score === 1,
        minPassRate: 0.8,
      },
    ],
  }
);
