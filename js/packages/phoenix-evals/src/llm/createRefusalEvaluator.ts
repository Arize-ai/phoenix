import { REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface RefusalEvaluatorArgs<
  RecordType extends Record<string, unknown> = RefusalEvaluationRecord,
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
 * A record to be evaluated by the refusal evaluator.
 */
export type RefusalEvaluationRecord = {
  input: string;
  output: string;
};

/**
 * Creates a refusal evaluator function.
 *
 * This function returns an evaluator that detects when an LLM refuses,
 * declines, or avoids answering a user query. It is use-case agnostic:
 * it only detects whether a refusal occurred, not whether the refusal
 * was appropriate.
 *
 * @param args - The arguments for creating the refusal evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to REFUSAL_CHOICES).
 * @param args.promptTemplate - The prompt template to use (defaults to REFUSAL_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link RefusalEvaluationRecord} and returns a classification result
 * indicating whether the output is a refusal or an answer.
 *
 * @example
 * ```ts
 * const evaluator = createRefusalEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   output: "I'm sorry, I can only help with technical questions.",
 * });
 * console.log(result.label); // "refused" or "answered"
 * ```
 */
export function createRefusalEvaluator<
  RecordType extends Record<string, unknown> = RefusalEvaluationRecord,
>(args: RefusalEvaluatorArgs<RecordType>): ClassificationEvaluator<RecordType> {
  const {
    choices = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = REFUSAL_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
