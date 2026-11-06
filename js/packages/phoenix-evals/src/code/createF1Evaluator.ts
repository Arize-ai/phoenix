import type { EvaluatorBase } from "../core/EvaluatorBase";
import type {
  ClassificationExample,
  PrecisionRecallFScoreOptions,
} from "./classificationMetrics";
import { createFBetaEvaluator } from "./createFBetaEvaluator";

export type F1EvaluatorOptions = Omit<PrecisionRecallFScoreOptions, "beta">;

/**
 * Creates a code evaluator that computes the F1 score: the harmonic mean of
 * precision and recall.
 *
 * Supports binary classification (via `positiveLabel`, or auto-detected when
 * labels are the numeric set `{0, 1}`) and multi-class classification (via
 * the `average` strategy).
 *
 * @example
 * ```typescript
 * const f1 = createF1Evaluator();
 * const result = await f1.evaluate({
 *   expected: ["cat", "dog", "cat", "bird"],
 *   output: ["cat", "cat", "cat", "bird"],
 * });
 * // { score: 0.6 }
 * ```
 */
export function createF1Evaluator<
  RecordType extends ClassificationExample = ClassificationExample,
>(options: F1EvaluatorOptions = {}): EvaluatorBase<RecordType> {
  return createFBetaEvaluator<RecordType>({ ...options, beta: 1 });
}
