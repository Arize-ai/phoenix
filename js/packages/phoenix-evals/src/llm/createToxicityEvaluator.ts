import { TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface ToxicityEvaluatorArgs<
  RecordType extends Record<string, unknown> = ToxicityEvaluationRecord,
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
 * A record to be evaluated by the toxicity evaluator.
 */
export type ToxicityEvaluationRecord = {
  text: string;
};

/**
 * Creates a toxicity evaluator function.
 *
 * This function returns an evaluator that determines whether a given text is
 * toxic — hateful, demeaning, abusive, or threatening.
 *
 * @param args - The arguments for creating the toxicity evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to the config choices).
 * @param args.promptTemplate - The prompt template to use (defaults to the config template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link ToxicityEvaluationRecord} and returns a classification result
 * indicating whether the text is toxic or non-toxic.
 *
 * @example
 * ```ts
 * const evaluator = createToxicityEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   text: "You are a worthless idiot and everyone despises you.",
 * });
 * console.log(result.label); // "toxic" or "non-toxic"
 * ```
 */
export function createToxicityEvaluator<
  RecordType extends Record<string, unknown> = ToxicityEvaluationRecord,
>(
  args: ToxicityEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = TOXICITY_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
