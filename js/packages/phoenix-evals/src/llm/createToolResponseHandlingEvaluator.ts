import { TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface ToolResponseHandlingEvaluatorArgs<
  RecordType extends Record<
    string,
    unknown
  > = ToolResponseHandlingEvaluationRecord,
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
 * A record to be evaluated by the tool response handling evaluator.
 */
export type ToolResponseHandlingEvaluationRecord = {
  /**
   * The user query or conversation context.
   */
  input: string;
  /**
   * The tool invocation(s) made by the agent, including arguments.
   */
  toolCall: string;
  /**
   * The tool's response (data, errors, or partial results).
   */
  toolResult: string;
  /**
   * The agent's handling after receiving the tool result
   * (may include retries, follow-ups, or final response).
   */
  output: string;
};

/**
 * Creates a tool response handling evaluator function.
 *
 * This function returns an evaluator that determines whether an AI agent properly
 * handled a tool's response, including error handling, data extraction,
 * transformation, and safe information disclosure.
 *
 * The evaluator checks for:
 * - Accurate data extraction from tool results (no hallucination)
 * - Proper transformation of dates, numbers, and structured fields
 * - Accurate summarization addressing the user's query
 * - Appropriate error handling (retries, corrections, user notification)
 * - No disclosure of sensitive information (credentials, PII, internal URLs)
 * - Actually using the tool result in the response
 *
 * @param args - The arguments for creating the tool response handling evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to correct/incorrect).
 * @param args.promptTemplate - The prompt template to use.
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link ToolResponseHandlingEvaluationRecord}
 * and returns a classification result indicating whether the tool response handling
 * is correct or incorrect.
 *
 * @example
 * ```ts
 * const evaluator = createToolResponseHandlingEvaluator({ model: openai("gpt-4o-mini") });
 *
 * // Example: Correct extraction from tool result
 * const result = await evaluator.evaluate({
 *   input: "What's the weather in Seattle?",
 *   toolCall: 'get_weather(location="Seattle")',
 *   toolResult: JSON.stringify({
 *     temperature: 58,
 *     unit: "fahrenheit",
 *     conditions: "partly cloudy"
 *   }),
 *   output: "The weather in Seattle is 58°F and partly cloudy."
 * });
 * console.log(result.label); // "correct"
 *
 * // Example: Hallucinated data (incorrect)
 * const resultHallucinated = await evaluator.evaluate({
 *   input: "What restaurants are nearby?",
 *   toolCall: 'search_restaurants(location="downtown")',
 *   toolResult: JSON.stringify({
 *     results: [{ name: "Cafe Luna", rating: 4.2 }]
 *   }),
 *   output: "I found Cafe Luna (4.2 stars) and Mario's Italian (4.8 stars) nearby."
 * });
 * console.log(resultHallucinated.label); // "incorrect" - Mario's was hallucinated
 * ```
 */
export function createToolResponseHandlingEvaluator<
  RecordType extends Record<
    string,
    unknown
  > = ToolResponseHandlingEvaluationRecord,
>(
  args: ToolResponseHandlingEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = TOOL_RESPONSE_HANDLING_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
