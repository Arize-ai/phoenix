import { createClassifier } from "./createClassifier";
import { CreateClassifierArgs, EvaluatorFn } from "../types/evals";
import {
  HALLUCINATION_TEMPLATE,
  HALLUCINATION_CHOICES,
} from "../default_templates/HALLUCINATION_TEMPLATE";

export interface HallucinationEvaluatorArgs
  extends Omit<CreateClassifierArgs, "promptTemplate" | "choices"> {
  choices?: CreateClassifierArgs["choices"];
  promptTemplate?: CreateClassifierArgs["promptTemplate"];
}

/**
 * An example to be evaluated by the hallucination evaluator.
 */
export type HallucinationExample = {
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
export function createHallucinationEvaluator(
  args: HallucinationEvaluatorArgs
): EvaluatorFn<HallucinationExample> {
  const {
    choices = HALLUCINATION_CHOICES,
    promptTemplate = HALLUCINATION_TEMPLATE,
    ...rest
  } = args;
  const hallucinationEvaluatorFn = createClassifier<HallucinationExample>({
    ...args,
    promptTemplate,
    choices,
    ...rest,
  });
  return hallucinationEvaluatorFn;
}
