import { createClassifier } from "./createClassifier";
import { CreateClassifierArgs, EvaluatorFn } from "../types/evals";
import {
  HALLUCINATION_TEMPLATE,
  HALLUCINATION_CHOICES,
} from "../default_templates/HALLUCINATION_TEMPLATE";

interface HallucinationEvaluatorArgs
  extends Omit<CreateClassifierArgs, "promptTemplate" | "choices"> {
  choices?: CreateClassifierArgs["choices"];
  promptTemplate?: CreateClassifierArgs["promptTemplate"];
}
/**
 * Creates a function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 *
 * @param args - The arguments for creating the hallucination evaluator.
 * @returns A function that evaluates whether an answer is factual or hallucinated based on a query and reference text.
 */
export function createHallucinationEvaluator(
  args: HallucinationEvaluatorArgs
): EvaluatorFn<string, string> {
  const {
    choices = HALLUCINATION_CHOICES,
    promptTemplate = HALLUCINATION_TEMPLATE,
    ...rest
  } = args;
  const hallucinationEvaluatorFn = createClassifier<string, string>({
    ...args,
    promptTemplate,
    choices,
    ...rest,
  });
  return hallucinationEvaluatorFn;
}
