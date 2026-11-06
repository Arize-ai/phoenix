import type { EvaluatorBase } from "../core/EvaluatorBase";
import {
  formatBetaForMetricName,
  getAverageMetricNameSuffix,
} from "./classificationMetrics";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";
import { createClassificationMetricEvaluator } from "./createClassificationMetricEvaluator";

/**
 * Creates a code evaluator that computes the F-beta score: the weighted
 * harmonic mean of precision and recall, where `beta` controls how much more
 * weight recall gets relative to precision (`beta = 1` is the standard F1
 * score).
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * `average` is at its default `"macro"` and labels are the numeric set
 * `{0, 1}`) and multi-class classification (via the `average` strategy).
 *
 * @example
 * ```typescript
 * const f2 = createFBetaEvaluator({ beta: 2 });
 * const result = await f2.evaluate({
 *   expected: ["cat", "dog", "cat", "bird"],
 *   output: ["cat", "cat", "cat", "bird"],
 * });
 * ```
 */
export function createFBetaEvaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(options: PrecisionRecallFScoreOptions = {}): EvaluatorBase<RecordType> {
  const { beta = 1 } = options;
  const suffix = getAverageMetricNameSuffix(options);
  return createClassificationMetricEvaluator<RecordType>(
    `${formatBetaForMetricName(beta)}${suffix}`,
    "fScore",
    options
  );
}
