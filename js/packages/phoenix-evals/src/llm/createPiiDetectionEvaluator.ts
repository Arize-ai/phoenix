import { PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface PiiDetectionEvaluatorArgs<
  RecordType extends Record<string, unknown> = PiiDetectionEvaluationRecord,
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
 * A conversation record to be screened for personally identifiable information.
 */
export type PiiDetectionEvaluationRecord = {
  /**
   * The full conversation record, including system instructions, turns,
   * tool calls, and retrieved content.
   */
  conversation: string;
};

/**
 * Creates a PII detection evaluator.
 *
 * This function returns an evaluator that screens a conversation record for
 * personally identifiable information, including content in tool calls,
 * tool results, and retrieved documents the end user may never have seen.
 *
 * @param args - The arguments for creating the PII detection evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to pii_detected/no_pii_detected).
 * @param args.promptTemplate - The prompt template to use (defaults to PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link PiiDetectionEvaluationRecord} and returns a classification result
 * indicating whether the record contains PII (`pii_detected`) or not (`no_pii_detected`).
 *
 * @example
 * ```ts
 * const evaluator = createPiiDetectionEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   conversation:
 *     "User: Reset my account.\nAssistant: What email is on the account?\nUser: jane.doe@acme.com",
 * });
 * console.log(result.label); // "pii_detected"
 * ```
 */
export function createPiiDetectionEvaluator<
  RecordType extends Record<string, unknown> = PiiDetectionEvaluationRecord,
>(
  args: PiiDetectionEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = PII_DETECTION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
