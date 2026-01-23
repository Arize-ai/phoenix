import { FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface FaithfulnessEvaluatorArgs<
  RecordType extends Record<string, unknown> = FaithfulnessEvaluationRecord,
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
 * A record to be evaluated by the faithfulness evaluator.
 */
export type FaithfulnessEvaluationRecord = {
  input: string;
  output: string;
  context?: string;
};
/**
 * Creates a function that evaluates whether an answer is faithful or unfaithful based on a query and reference text.
 *
 * @param args - The arguments for creating the faithfulness evaluator.
 * @returns A function that evaluates whether an answer is faithful or unfaithful based on a query and reference text.
 */
export function createFaithfulnessEvaluator<
  RecordType extends Record<string, unknown> = FaithfulnessEvaluationRecord,
>(
  args: FaithfulnessEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = FAITHFULNESS_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
