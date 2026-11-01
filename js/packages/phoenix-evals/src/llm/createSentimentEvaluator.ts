import { SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface SentimentEvaluatorArgs<
  RecordType extends Record<string, unknown> = SentimentEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/** A conversation and the latest user message to classify for expressed sentiment. */
export interface SentimentEvaluationRecord {
  /**
   * Human-readable conversation history before the target user message.
   */
  conversation: string;
  /**
   * The latest user message to classify for expressed sentiment.
   */
  userMessage: string;
  [key: string]: unknown;
}

/**
 * Creates a sentiment evaluator function.
 *
 * This function returns an evaluator that labels the sentiment the user
 * expresses in their latest message as positive, neutral, or negative. It
 * judges the user's own expressed affect, not the assistant's tone and not
 * whether the topic is inherently pleasant or unpleasant.
 *
 * @param args - The arguments for creating the sentiment evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to positive/neutral/negative).
 * @param args.promptTemplate - The prompt template to use (defaults to SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link SentimentEvaluationRecord} and returns a classification result
 * indicating whether the latest user message expresses positive, neutral, or negative sentiment.
 *
 * @example
 * ```ts
 * const evaluator = createSentimentEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   conversation: "User: My order still hasn't arrived.\nAssistant: Let me check.",
 *   userMessage: "This is the third time I've had to ask.",
 * });
 * console.log(result.label); // "negative"
 * ```
 */
export function createSentimentEvaluator<
  RecordType extends Record<string, unknown> = SentimentEvaluationRecord,
>(
  args: SentimentEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = SENTIMENT_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
