import { CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface ConcisenessEvaluatorArgs<
  RecordType extends Record<string, unknown> = ConcisenessEvaluationRecord,
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
 * A record to be evaluated by the conciseness evaluator.
 */
export type ConcisenessEvaluationRecord = {
  input: string;
  output: string;
};

/**
 * Creates a conciseness evaluator function.
 *
 * This function returns an evaluator that determines whether a given output
 * is concise and free of unnecessary content such as pleasantries, hedging,
 * meta-commentary, or redundant information.
 *
 * @param args - The arguments for creating the conciseness evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to CONCISENESS_CHOICES).
 * @param args.promptTemplate - The prompt template to use (defaults to CONCISENESS_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link ConcisenessEvaluationRecord} and returns a classification result
 * indicating whether the output is concise or verbose.
 *
 * @example
 * ```ts
 * const evaluator = createConcisenessEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   output: "Paris.",
 * });
 * console.log(result.label); // "concise" or "verbose"
 * ```
 */
export function createConcisenessEvaluator<
  RecordType extends Record<string, unknown> = ConcisenessEvaluationRecord,
>(
  args: ConcisenessEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = CONCISENESS_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
