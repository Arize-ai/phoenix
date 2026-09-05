import { DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface DocumentRelevanceEvaluatorArgs<
  RecordType extends Record<string, unknown> =
    DocumentRelevanceEvaluationRecord,
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
 * A record to be evaluated by the document relevance evaluator.
 *
 * @deprecated Use the retrieval relevance evaluator's record shape instead, which
 * names this field `context` rather than `documentText`.
 */
export interface DocumentRelevanceEvaluationRecord {
  input: string;
  documentText: string;
  [key: string]: unknown;
}

/**
 * Creates a document relevance evaluator function.
 *
 * @deprecated Use {@link createRetrievalRelevanceEvaluator} instead. It covers both
 * single-document and holistic retrieval evaluation, and the documentation has
 * recommended it since the Document Relevance page was removed. When migrating, the
 * input field `documentText` becomes `context` and the negative label `unrelated`
 * becomes `irrelevant`. Per-document evaluation is still possible: pass a single
 * document as `context` and call the evaluator once per document.
 *
 * This function returns an evaluator that determines whether a given document text
 * is relevant to a provided input question. The evaluator uses a classification model
 * and a prompt template to make its determination.
 *
 * @param args - The arguments for creating the document relevance evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to DOCUMENT_RELEVANCE_CHOICES).
 * @param args.promptTemplate - The prompt template to use (defaults to DOCUMENT_RELEVANCE_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link DocumentRelevanceExample} and returns a classification result
 * indicating whether the document is relevant to the input question.
 *
 * @example
 * ```ts
 * const evaluator = createDocumentRelevanceEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   documentText: "Paris is the capital and most populous city of France.",
 * });
 * console.log(result.label); // "relevant" or "unrelated"
 * ```
 */
export function createDocumentRelevanceEvaluator<
  RecordType extends Record<string, unknown> =
    DocumentRelevanceEvaluationRecord,
>(
  args: DocumentRelevanceEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = DOCUMENT_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
