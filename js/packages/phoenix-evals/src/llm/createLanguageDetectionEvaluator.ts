import { LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface LanguageDetectionEvaluatorArgs<
  RecordType extends Record<string, unknown> =
    LanguageDetectionEvaluationRecord,
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
 * A record to be evaluated by the language detection evaluator.
 */
export type LanguageDetectionEvaluationRecord = {
  /** User and assistant turns, in chronological order. Do not include tool results. */
  session: string;
};

/**
 * Creates a language detection evaluator function.
 *
 * This function returns an evaluator that identifies the primary natural
 * language used throughout a conversation session. It is descriptive only:
 * it does not judge whether that language was correct or expected.
 *
 * @param args - The arguments for creating the language detection evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to the built-in language labels).
 * @param args.promptTemplate - The prompt template to use (defaults to the built-in language detection template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link LanguageDetectionEvaluationRecord} and returns a classification result
 * indicating the session's primary language.
 *
 * @example
 * ```ts
 * const evaluator = createLanguageDetectionEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   session: "User: My deploy failed.\\nAssistant: Raise the memory limit.",
 * });
 * console.log(result.label); // "english"
 * ```
 */
export function createLanguageDetectionEvaluator<
  RecordType extends Record<string, unknown> =
    LanguageDetectionEvaluationRecord,
>(
  args: LanguageDetectionEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = LANGUAGE_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
