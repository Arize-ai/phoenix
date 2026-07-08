import type { EvaluatorBase } from "../core/EvaluatorBase";
import { createEvaluator } from "../helpers/createEvaluator";
import {
  computePrecisionRecallFScore,
  type ClassificationExample,
  type PrecisionRecallFScoreOptions,
  type PrecisionRecallFScoreResult,
} from "./classificationMetrics";

/**
 * Computes a {@link PrecisionRecallFScoreResult} for a batch of labels.
 * Injectable so callers (e.g. {@link createPrecisionRecallFScoreEvaluators})
 * can share one computed result across multiple metric evaluators instead of
 * recomputing it per evaluator.
 */
export type ClassificationMetricComputer = (
  example: Pick<ClassificationExample, "expected" | "output">,
  options: PrecisionRecallFScoreOptions
) => PrecisionRecallFScoreResult;

/**
 * Internal factory shared by `createPrecisionEvaluator`, `createRecallEvaluator`,
 * and `createFBetaEvaluator` — each is a thin wrapper that only differs in
 * which result field it reads and how its metric name is built.
 */
export function createClassificationMetricEvaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(
  name: string,
  field: "precision" | "recall" | "fScore",
  options: PrecisionRecallFScoreOptions,
  compute: ClassificationMetricComputer = computePrecisionRecallFScore
): EvaluatorBase<RecordType> {
  return createEvaluator<RecordType>(
    // Pass `example` through by reference (rather than destructuring and
    // rebuilding a new object) so callers that share one computed result by
    // caching on object identity (e.g. `createPrecisionRecallFScoreEvaluators`)
    // actually get a cache hit.
    (example) => {
      const result = compute(example, options);
      return { score: result[field] };
    },
    {
      name,
      kind: "CODE",
      optimizationDirection: "MAXIMIZE",
    }
  );
}
