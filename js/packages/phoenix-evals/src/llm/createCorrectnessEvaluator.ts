import { CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface CorrectnessEvaluatorArgs<
  RecordType extends Record<string, unknown> = CorrectnessEvaluationRecord,
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
 * A record to be evaluated by the correctness evaluator.
 */
export type CorrectnessEvaluationRecord = {
  input: string;
  output: string;
};

/**
 * Creates a correctness evaluator function.
 *
 * This function returns an evaluator that determines whether a given output
 * is factually accurate, complete, logically consistent, and uses precise terminology.
 *
 * @param args - The arguments for creating the correctness evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to CORRECTNESS_CHOICES).
 * @param args.promptTemplate - The prompt template to use (defaults to CORRECTNESS_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link CorrectnessEvaluationRecord} and returns a classification result
 * indicating whether the output is correct or incorrect.
 *
 * @example
 * ```ts
 * const evaluator = createCorrectnessEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   output: "Paris is the capital of France.",
 * });
 * console.log(result.label); // "correct" or "incorrect"
 * ```
 */
export function createCorrectnessEvaluator<
  RecordType extends Record<string, unknown> = CorrectnessEvaluationRecord,
>(
  args: CorrectnessEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
