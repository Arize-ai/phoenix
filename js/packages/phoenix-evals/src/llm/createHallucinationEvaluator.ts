import { CreateClassificationEvaluatorArgs } from "../types/evals";
import {
  HALLUCINATION_TEMPLATE,
  HALLUCINATION_CHOICES,
} from "../default_templates/HALLUCINATION_TEMPLATE";
import { createClassificationEvaluator } from "./createClassificationEvaluator";
import { ClassificationEvaluator } from "./ClassificationEvaluator";

export interface HallucinationEvaluatorArgs
  extends Omit<
    CreateClassificationEvaluatorArgs,
    "promptTemplate" | "choices" | "optimizationDirection" | "name"
  > {
  optimizationDirection?: CreateClassificationEvaluatorArgs["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs["name"];
  choices?: CreateClassificationEvaluatorArgs["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs["promptTemplate"];
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
  T extends Record<string, unknown> = HallucinationEvaluationRecord,
>(args: HallucinationEvaluatorArgs): ClassificationEvaluator<T> {
  const {
    choices = HALLUCINATION_CHOICES,
    promptTemplate = HALLUCINATION_TEMPLATE,
    optimizationDirection = "MINIMIZE",
    name = "hallucination",
    ...rest
  } = args;
  return createClassificationEvaluator<T>({
    ...args,
    promptTemplate,
    choices,
    optimizationDirection,
    name,
    ...rest,
  });
}
