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
 * Creates a code evaluator that computes the F-beta score: the weighted
 * harmonic mean of precision and recall, where `beta` controls how much more
 * weight recall gets relative to precision (`beta = 1` is the standard F1
 * score).
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * labels are the numeric set `{0, 1}`) and multi-class classification (via
 * the `average` strategy).
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
  return createEvaluator<RecordType>(
    ({ expected, output }) => {
      const result = computePrecisionRecallFScore(
        { expected, output },
        options
      );
      return { score: result.fScore };
    },
    {
      name: `${formatBetaForMetricName(beta)}${suffix}`,
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );
}
