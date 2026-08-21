import { RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import type { CreateClassificationEvaluatorArgs } from "../types/evals";
import type { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface RetrievalRelevanceEvaluatorArgs<
  RecordType extends Record<string, unknown> =
    RetrievalRelevanceEvaluationRecord,
> extends Omit<
  CreateClassificationEvaluatorArgs<RecordType>,
  "promptTemplate" | "choices" | "optimizationDirection" | "name"
> {
  optimizationDirection?: CreateClassificationEvaluatorArgs<RecordType>["optimizationDirection"];
  name?: CreateClassificationEvaluatorArgs<RecordType>["name"];
  choices?: CreateClassificationEvaluatorArgs<RecordType>["choices"];
  promptTemplate?: CreateClassificationEvaluatorArgs<RecordType>["promptTemplate"];
}

/** A request and the external information retrieved to serve it. */
export interface RetrievalRelevanceEvaluationRecord {
  /**
   * The request the retrieval was serving. Prefer the user's request (e.g. the
   * trace root's input) over a reformulated tool argument or generated query.
   */
  input: string;
  /**
   * The external information retrieved during the step, with all returned items
   * joined together. Source-agnostic: vector search, tool/MCP call, web search,
   * or content embedded in an LLM turn.
   */
  context: string;
  [key: string]: unknown;
}

/**
 * Creates a retrieval relevance evaluator function.
 *
 * This function returns an evaluator that determines whether the external
 * information retrieved during a step is relevant to the request it was
 * serving. Unlike {@link createDocumentRelevanceEvaluator}, which judges a
 * single document against a question, this evaluator is source-agnostic and
 * scores the retrieved information as a whole (holistically, per retrieval
 * step), whether it came from a vector search, a tool or MCP call, a web
 * search, or content embedded in an LLM turn.
 *
 * @param args - The arguments for creating the retrieval relevance evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to relevant/irrelevant).
 * @param args.promptTemplate - The prompt template to use (defaults to RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.template).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link RetrievalRelevanceEvaluationRecord} and returns a classification result
 * indicating whether the retrieved information is relevant or irrelevant to the request.
 *
 * @example
 * ```ts
 * const evaluator = createRetrievalRelevanceEvaluator({ model: openai("gpt-4o-mini") });
 * const result = await evaluator.evaluate({
 *   input: "What is the capital of France?",
 *   context: "Paris is the capital and largest city of France.",
 * });
 * console.log(result.label); // "relevant"
 * ```
 */
export function createRetrievalRelevanceEvaluator<
  RecordType extends Record<string, unknown> =
    RetrievalRelevanceEvaluationRecord,
>(
  args: RetrievalRelevanceEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = RETRIEVAL_RELEVANCE_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
