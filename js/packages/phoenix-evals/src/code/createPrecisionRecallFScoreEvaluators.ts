import type { EvaluatorBase } from "../core/EvaluatorBase";
import {
  computePrecisionRecallFScore,
  formatBetaForMetricName,
  getAverageMetricNameSuffix,
} from "./classificationMetrics";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
  PrecisionRecallFScoreResult,
} from "./classificationMetrics";
import { createClassificationMetricEvaluator } from "./createClassificationMetricEvaluator";
import type { ClassificationMetricComputer } from "./createClassificationMetricEvaluator";

export interface PrecisionRecallFScoreEvaluators<
  RecordType extends ClassificationExample,
> {
  precision: EvaluatorBase<RecordType>;
  recall: EvaluatorBase<RecordType>;
  fScore: EvaluatorBase<RecordType>;
}

/**
 * Wraps `computePrecisionRecallFScore` so repeated calls with the same
 * `example` object (by reference) reuse the first computed result, instead
 * of recomputing the full confusion matrix once per evaluator.
 */
function createCachedComputer(): ClassificationMetricComputer {
  const cache = new WeakMap<object, PrecisionRecallFScoreResult>();
  return (example, options) => {
    const cached = cache.get(example);
    if (cached) {
      return cached;
    }
    const result = computePrecisionRecallFScore(example, options);
    cache.set(example, result);
    return result;
  };
}

/**
 * Creates matching precision, recall, and F-beta evaluators from a single set
 * of options, so all three are computed with the same `average`, `beta`,
 * `positiveLabel`, and `zeroDivision` settings. When the same `expected`/
 * `output` example object is passed to all three evaluators, the underlying
 * confusion matrix is only computed once and shared across them.
 *
 * @example
 * ```typescript
 * const { precision, recall, fScore } = createPrecisionRecallFScoreEvaluators({
 *   average: "weighted",
 * });
 * ```
 */
export function createPrecisionRecallFScoreEvaluators<
  RecordType extends ClassificationExample = ClassificationExample,
>(
  options: PrecisionRecallFScoreOptions = {}
): PrecisionRecallFScoreEvaluators<RecordType> {
  const { beta = 1 } = options;
  const suffix = getAverageMetricNameSuffix(options);
  const compute = createCachedComputer();
  return {
    precision: createClassificationMetricEvaluator<RecordType>(
      `precision${suffix}`,
      "precision",
      options,
      compute
    ),
    recall: createClassificationMetricEvaluator<RecordType>(
      `recall${suffix}`,
      "recall",
      options,
      compute
    ),
    fScore: createClassificationMetricEvaluator<RecordType>(
      `${formatBetaForMetricName(beta)}${suffix}`,
      "fScore",
      options,
      compute
    ),
  };
}
