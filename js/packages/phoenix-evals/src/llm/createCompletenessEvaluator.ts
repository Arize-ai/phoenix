import { COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface CompletenessEvaluatorArgs<
  RecordType extends Record<string, unknown> = CompletenessEvaluationRecord,
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
 * A conversation record to judge for coverage of user intentions.
 */
export type CompletenessEvaluationRecord = {
  /**
   * The full conversation, including turns, tool calls, and tool results.
   */
  conversation: string;
  [key: string]: unknown;
};

/**
 * Creates a completeness evaluator.
 *
 * This function returns an evaluator that checks whether the assistant
 * addressed every distinct intention the user raised in a conversation.
 *
 * @param args - The arguments for creating the completeness evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to complete/incomplete).
 * @param args.promptTemplate - The prompt template to use (defaults to COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link CompletenessEvaluationRecord} and returns a classification result
 * indicating whether the conversation is `complete` or `incomplete`.
 *
 * @example
 * ```ts
 * const evaluator = createCompletenessEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   conversation:
 *     "User: Reset my password and update the billing address.\nAssistant: Your password has been reset.",
 * });
 * console.log(result.label); // "incomplete"
 * ```
 */
export function createCompletenessEvaluator<
  RecordType extends Record<string, unknown> = CompletenessEvaluationRecord,
>(
  args: CompletenessEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = COMPLETENESS_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
