import {
  DOCUMENT_RELEVANCY_CHOICES,
  DOCUMENT_RELEVANCY_TEMPLATE,
} from "../default_templates/DOCUMENT_RELEVANCY_TEMPLATE";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface DocumentRelevancyEvaluatorArgs<
  RecordType extends Record<
    string,
    unknown
  > = DocumentRelevancyEvaluationRecord,
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
 * A record to be evaluated by the document relevancy evaluator.
 */
export interface DocumentRelevancyEvaluationRecord {
  input: string;
  documentText: string;
  [key: string]: unknown;
}

/**
 * Creates a document relevancy evaluator function.
 *
 * This function returns an evaluator that determines whether a given document text
 * is relevant to a provided input question. The evaluator uses a classification model
 * and a prompt template to make its determination.
 *
 * @param args - The arguments for creating the document relevancy evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to DOCUMENT_RELEVANCY_CHOICES).
 * @param args.promptTemplate - The prompt template to use (defaults to DOCUMENT_RELEVANCY_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link DocumentRelevancyExample} and returns a classification result
 * indicating whether the document is relevant to the input question.
 *
 * @example
 * ```ts
 * const evaluator = createDocumentRelevancyEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   documentText: "Paris is the capital and most populous city of France.",
 * });
 * console.log(result.label); // "relevant" or "unrelated"
 * ```
 */
export function createDocumentRelevancyEvaluator<
  RecordType extends Record<
    string,
    unknown
  > = DocumentRelevancyEvaluationRecord,
>(
  args: DocumentRelevancyEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  return createClassificationEvaluator<RecordType>({
    ...args,
    promptTemplate: DOCUMENT_RELEVANCY_TEMPLATE,
    choices: DOCUMENT_RELEVANCY_CHOICES,
    optimizationDirection: "MAXIMIZE",
    name: "document_relevancy",
  });
}
