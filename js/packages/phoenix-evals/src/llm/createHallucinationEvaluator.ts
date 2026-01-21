/**
 * @deprecated This evaluator is maintained for backwards compatibility.
 * Please use createFaithfulnessEvaluator instead, which uses updated terminology:
 * - 'faithful'/'unfaithful' labels instead of 'factual'/'hallucinated'
 * - Maximizes score (1.0=faithful) instead of minimizing it
 */

import { HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface HallucinationEvaluatorArgs<
  RecordType extends Record<string, unknown> = HallucinationEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/**
 * A record to be evaluated by the hallucination evaluator.
 */
export type HallucinationEvaluationRecord = {
  input: string;
  output: string;
  context?: string;
};

/**
 * @deprecated Use createFaithfulnessEvaluator instead.
 *
 * Creates a function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 *
 * Note: This is deprecated. Please use createFaithfulnessEvaluator which:
 * - Uses 'faithful'/'unfaithful' labels instead of 'factual'/'hallucinated'
 * - Maximizes the score (1.0 for faithful, 0.0 for unfaithful)
 *
 * @param args - The arguments for creating the hallucination evaluator.
 * @returns A function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 */
export function createHallucinationEvaluator<
  RecordType extends Record<string, unknown> = HallucinationEvaluationRecord,
>(
  args: HallucinationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  // eslint-disable-next-line no-console
  console.warn(
    "createHallucinationEvaluator is deprecated and will be removed in a future version. " +
      "Please use createFaithfulnessEvaluator instead. The new evaluator uses " +
      "'faithful'/'unfaithful' labels and maximizes score (1.0=faithful) instead of " +
      "minimizing it (0.0=factual)."
  );

  const {
    choices = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.name,
    ...rest
  } = args;
  return createClassificationEvaluator<RecordType>({
    ...rest,
    promptTemplate,
    choices,
    optimizationDirection,
    name,
  });
}
