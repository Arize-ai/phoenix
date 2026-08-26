import { HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface HallucinationEvaluatorArgs<
  RecordType extends Record<string, unknown> = HallucinationEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/** A conversation and the assistant response to evaluate for hallucination. */
export interface HallucinationEvaluationRecord {
  /**
   * The full conversation history the assistant had access to (prior turns,
   * tool calls, and tool results); its last message is the user turn being
   * answered. Treated as the source of truth.
   */
  input: string;
  /**
   * The assistant's latest response to classify.
   */
  output: string;
  [key: string]: unknown;
}

/**
 * Creates a hallucination evaluator function.
 *
 * This function returns an evaluator that detects whether an assistant's latest
 * response contains claims that are not grounded in — unsupported by, or
 * contradicting — the conversation. Unlike the faithfulness evaluator, which
 * grounds a response against a specific provided context (e.g. retrieved
 * documents), this grounds it against the conversation itself.
 *
 * @param args - The arguments for creating the hallucination evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to hallucinated/grounded).
 * @param args.promptTemplate - The prompt template to use (defaults to HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link HallucinationEvaluationRecord} and returns a classification result
 * indicating whether the response is grounded or hallucinated relative to the conversation.
 *
 * @example
 * ```ts
 * const evaluator = createHallucinationEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input:
 *     "User: What's our refund window?\nTool (lookup_policy): Refunds: 30 days from delivery.\nAssistant: 30 days from delivery.\nUser: And for electronics?",
 *   output: "Electronics can be returned within 90 days.",
 * });
 * console.log(result.label); // "hallucinated"
 * ```
 */
export function createHallucinationEvaluator<
  RecordType extends Record<string, unknown> = HallucinationEvaluationRecord,
>(
  args: HallucinationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
