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
 * Creates a code evaluator that computes recall: of the labels that actually
 * belong to a given class, the fraction the model correctly predicted.
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * labels are the numeric set `{0, 1}`) and multi-class classification (via
 * the `average` strategy).
 *
 * @example
 * ```typescript
 * const recall = createRecallEvaluator();
 * const result = await recall.evaluate({
 *   expected: ["cat", "dog", "cat", "bird"],
 *   output: ["cat", "cat", "cat", "bird"],
 * });
 * // { score: 2/3 }
 * ```
 */
export function createRecallEvaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(options: PrecisionRecallFScoreOptions = {}): EvaluatorBase<RecordType> {
  const suffix = getAverageMetricNameSuffix(options);
  return createEvaluator<RecordType>(
    ({ expected, output }) => {
      const result = computePrecisionRecallFScore(
        { expected, output },
        options
      );
      return { score: result.recall };
    },
    {
      name: `recall${suffix}`,
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );
}
