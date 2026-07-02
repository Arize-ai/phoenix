import type { EvaluatorBase } from "../core/EvaluatorBase";
import { createEvaluator } from "../helpers/createEvaluator";
import {
  computePrecisionRecallFScore,
  formatBetaForMetricName,
  getAverageMetricNameSuffix,
} from "./classificationMetrics";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";

/**
 * Creates a single composed code evaluator that computes precision, recall,
 * and F-beta together in one pass — the TypeScript analog of Python's
 * `PrecisionRecallFScore`, which returns all three metrics from one
 * evaluator.
 *
 * Because an {@link EvaluatorBase} produces one {@link EvaluationResult} per
 * call, the F-beta score (the single number that combines precision and
 * recall) is returned as the headline `score`, while all three metrics — and
 * the resolved `beta`, `average`, `labels`, and `positiveLabel` — are
 * attached to `metadata` for programmatic access, with a human-readable
 * breakdown in `explanation`.
 *
 * If you'd rather have three separate evaluators (one score each) — for
 * example to chart precision, recall, and F-score as distinct metrics in a
 * Phoenix experiment — use
 * {@link createPrecisionRecallFScoreEvaluators} instead.
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * `average` is at its default `"macro"` and labels are the numeric set
 * `{0, 1}`) and multi-class classification (via the `average` strategy).
 *
 * @example
 * ```typescript
 * const evaluator = createPrecisionRecallFScoreEvaluator();
 * const result = await evaluator.evaluate({
 *   expected: ["cat", "dog", "cat", "bird", "dog"],
 *   output: ["cat", "cat", "cat", "bird", "dog"],
 * });
 * // {
 * //   score: 0.8222222222222223, // the F1 score (unrounded)
 * //   explanation: "precision=0.888889, recall=0.833333, f1=0.822222", // rounded to 6 dp
 * //   metadata: { precision: 0.888..., recall: 0.833..., fScore: 0.822..., beta: 1, average: "macro", ... },
 * // }
 * ```
 */
export function createPrecisionRecallFScoreEvaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(options: PrecisionRecallFScoreOptions = {}): EvaluatorBase<RecordType> {
  const { beta = 1 } = options;
  const suffix = getAverageMetricNameSuffix(options);
  const fScoreName = `${formatBetaForMetricName(beta)}${suffix}`;
  return createEvaluator<RecordType>(
    (example) => {
      const result = computePrecisionRecallFScore(example, options);
      const round = (value: number) => Number(value.toFixed(6));
      return {
        // The F-beta score is the single number that combines precision and
        // recall; expose it as the headline score, with the full breakdown
        // available in metadata.
        score: result.fScore,
        explanation:
          `precision${suffix}=${round(result.precision)}, ` +
          `recall${suffix}=${round(result.recall)}, ` +
          `${fScoreName}=${round(result.fScore)}`,
        metadata: {
          precision: result.precision,
          recall: result.recall,
          fScore: result.fScore,
          beta: result.beta,
          average: result.average,
          labels: result.labels,
          positiveLabel: result.positiveLabel,
        },
      };
    },
    {
      name: "precision_recall_fscore",
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );
}
