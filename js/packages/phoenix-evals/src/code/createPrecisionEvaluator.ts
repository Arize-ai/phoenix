import type { EvaluatorBase } from "../core/EvaluatorBase";
import { getAverageMetricNameSuffix } from "./classificationMetrics";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";
import { createClassificationMetricEvaluator } from "./createClassificationMetricEvaluator";

/**
 * Creates a code evaluator that computes precision: of the labels the model
 * predicted as a given class, the fraction that were actually that class.
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * `average` is at its default `"macro"` and labels are the numeric set
 * `{0, 1}`) and multi-class classification (via the `average` strategy).
 *
 * @example
 * ```typescript
 * const precision = createPrecisionEvaluator();
 * const result = await precision.evaluate({
 *   expected: ["cat", "dog", "cat", "bird"],
 *   output: ["cat", "cat", "cat", "bird"],
 * });
 * // { score: 5/9 }
 * ```
 */
export function createPrecisionEvaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(options: PrecisionRecallFScoreOptions = {}): EvaluatorBase<RecordType> {
  const suffix = getAverageMetricNameSuffix(options);
  return createClassificationMetricEvaluator<RecordType>(
    `precision${suffix}`,
    "precision",
    options
  );
}
