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
   * The conversation available to the assistant: prior turns, tool calls,
   * tool results, and any retrieved context. Treated as the source of truth.
   */
  conversation: string;
  /**
   * The latest user message the response is answering.
   */
  input: string;
  /**
   * The assistant response to classify.
   */
  output: string;
  [key: string]: unknown;
}

/**
 * Creates a hallucination evaluator function.
 *
 * This function returns an evaluator that detects whether an assistant response
 * contains claims that are unsupported by, or that contradict, the conversation.
 *
 * @param args - The arguments for creating the hallucination evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to hallucinated/factual).
 * @param args.promptTemplate - The prompt template to use (defaults to HALLUCINATION_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link HallucinationEvaluationRecord} and returns a classification result
 * indicating whether the response is factual or hallucinated relative to the conversation.
 *
 * @example
 * ```ts
 * const evaluator = createHallucinationEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   conversation:
 *     "User: What's our refund window?\nTool (lookup_policy): Refunds: 30 days from delivery.\nAssistant: 30 days from delivery.",
 *   input: "And for electronics?",
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
