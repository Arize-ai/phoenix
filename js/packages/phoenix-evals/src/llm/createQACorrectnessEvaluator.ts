import { QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface QACorrectnessEvaluatorArgs<
  RecordType extends Record<string, unknown> = QACorrectnessEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/** A question, an answer, and the reference text to judge the answer against. */
export interface QACorrectnessEvaluationRecord {
  /**
   * The question the answer is responding to.
   */
  input: string;
  /**
   * The answer to evaluate.
   */
  output: string;
  /**
   * The reference text used as the source of truth.
   */
  reference: string;
  [key: string]: unknown;
}

/**
 * Creates a Q&A correctness evaluator function.
 *
 * This function returns an evaluator that determines whether an answer
 * correctly and completely answers a question, using the reference text as the
 * source of truth.
 *
 * @param args - The arguments for creating the Q&A correctness evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to correct/incorrect).
 * @param args.promptTemplate - The prompt template to use (defaults to QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link QACorrectnessEvaluationRecord} and returns a classification result
 * indicating whether the answer is correct or incorrect relative to the reference.
 *
 * @example
 * ```ts
 * const evaluator = createQACorrectnessEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   output: "The capital of France is Paris.",
 *   reference: "Paris is the capital and largest city of France.",
 * });
 * console.log(result.label); // "correct"
 * ```
 */
export function createQACorrectnessEvaluator<
  RecordType extends Record<string, unknown> = QACorrectnessEvaluationRecord,
>(
  args: QACorrectnessEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = QA_CORRECTNESS_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
