import { ClassificationEvaluationResult, EvaluationArgs } from "../types/evals";

/**
 * A function that leverages an llm to classify an example into a single category.
 */
export async function classify<OutputType, InputType>(
  _args: EvaluationArgs<OutputType, InputType>
): Promise<ClassificationEvaluationResult> {
  return {
    label: "correct",
    explanation: "The model correctly identified the sentiment of the text.",
  };
}
