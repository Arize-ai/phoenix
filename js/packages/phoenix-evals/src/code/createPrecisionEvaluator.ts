import type { EvaluatorBase } from "../core/EvaluatorBase";
import { createEvaluator } from "../helpers/createEvaluator";
import {
  computePrecisionRecallFScore,
  getAverageMetricNameSuffix,
} from "./classificationMetrics";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";

/**
 * Creates a code evaluator that computes precision: of the labels the model
 * predicted as a given class, the fraction that were actually that class.
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * labels are the numeric set `{0, 1}`) and multi-class classification (via
 * the `average` strategy).
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
  return createEvaluator<RecordType>(
    ({ expected, output }) => {
      const result = computePrecisionRecallFScore(
        { expected, output },
        options
      );
      return { score: result.precision };
    },
    {
      name: `precision${suffix}`,
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );
}
