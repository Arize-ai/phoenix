import { USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface UserFrictionEvaluatorArgs<
  RecordType extends Record<string, unknown> = UserFrictionEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/** A conversation and the latest user message to evaluate for expressed friction. */
export interface UserFrictionEvaluationRecord {
  conversation: string;
  userMessage: string;
  [key: string]: unknown;
}

/**
 * Creates an evaluator that detects expressed user friction with an assistant's
 * preceding behavior.
 *
 * @example
 * ```ts
 * const evaluator = createUserFrictionEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   conversation: "User: Show recent orders.\nAssistant: Here are last month's orders.",
 *   userMessage: "No, I asked for this week.",
 * });
 * console.log(result.label); // "friction"
 * ```
 */
export function createUserFrictionEvaluator<
  RecordType extends Record<string, unknown> = UserFrictionEvaluationRecord,
>(
  args: UserFrictionEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = USER_FRICTION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
