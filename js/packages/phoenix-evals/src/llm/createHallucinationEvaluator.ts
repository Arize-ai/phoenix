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
  reference?: string;
  context?: string;
};
/**
 * Creates a function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 *
 * @param args - The arguments for creating the hallucination evaluator.
 * @returns A function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 */
export function createHallucinationEvaluator<
  RecordType extends Record<string, unknown> = HallucinationEvaluationRecord,
>(
  args: HallucinationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
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
