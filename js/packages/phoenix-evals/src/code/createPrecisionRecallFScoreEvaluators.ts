import type { EvaluatorBase } from "../core/EvaluatorBase";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";
import { createFBetaEvaluator } from "./createFBetaEvaluator";
import { createPrecisionEvaluator } from "./createPrecisionEvaluator";
import { createRecallEvaluator } from "./createRecallEvaluator";

export interface PrecisionRecallFScoreEvaluators<
  RecordType extends ClassificationExample,
> {
  precision: EvaluatorBase<RecordType>;
  recall: EvaluatorBase<RecordType>;
  fScore: EvaluatorBase<RecordType>;
}

/**
 * Creates matching precision, recall, and F-beta evaluators from a single set
 * of options, so all three are computed with the same `average`, `beta`,
 * `positiveLabel`, and `zeroDivision` settings.
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
  return {
    precision: createPrecisionEvaluator<RecordType>(options),
    recall: createRecallEvaluator<RecordType>(options),
    fScore: createFBetaEvaluator<RecordType>(options),
  };
}
