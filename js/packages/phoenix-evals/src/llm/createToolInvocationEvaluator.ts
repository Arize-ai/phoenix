import { TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface ToolInvocationEvaluatorArgs<
  RecordType extends Record<string, unknown> = ToolInvocationEvaluationRecord,
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
 * A record to be evaluated by the tool invocation evaluator.
 */
export type ToolInvocationEvaluationRecord = {
  /**
   * The input query or conversation context.
   */
  input: string;
  /**
   * The available tool schemas, either as JSON schema or human-readable format.
   */
  availableTools: string;
  /**
   * The tool invocation(s) made by the LLM, including arguments.
   */
  toolSelection: string;
};

/**
 * Creates a tool invocation evaluator function.
 *
 * This function returns an evaluator that determines whether a tool was invoked
 * correctly with proper arguments, formatting, and safe content.
 *
 * The evaluator checks for:
 * - Properly structured JSON (if applicable)
 * - All required fields/parameters present
 * - No hallucinated or nonexistent fields
 * - Argument values matching user query and schema expectations
 * - No unsafe content (e.g., PII) in arguments
 *
 * @param args - The arguments for creating the tool invocation evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to correct/incorrect).
 * @param args.promptTemplate - The prompt template to use (defaults to TOOL_INVOCATION_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link ToolInvocationEvaluationRecord} and returns
 * a classification result indicating whether the tool invocation is correct or incorrect.
 *
 * @example
 * ```ts
 * const evaluator = createToolInvocationEvaluator({ model: openai("gpt-4o-mini") });
 *
 * // Example with JSON schema format for available tools
 * const result = await evaluator.evaluate({
 *   input: "User: Book a flight from NYC to LA for tomorrow",
 *   availableTools: JSON.stringify({
 *     name: "book_flight",
 *     description: "Book a flight between two cities",
 *     parameters: {
 *       type: "object",
 *       properties: {
 *         origin: { type: "string", description: "Departure city code" },
 *         destination: { type: "string", description: "Arrival city code" },
 *         date: { type: "string", description: "Flight date in YYYY-MM-DD" }
 *       },
 *       required: ["origin", "destination", "date"]
 *     }
 *   }),
 *   toolSelection: 'book_flight(origin="NYC", destination="LA", date="2024-01-15")'
 * });
 * console.log(result.label); // "correct" or "incorrect"
 * ```
 */
export function createToolInvocationEvaluator<
  RecordType extends Record<string, unknown> = ToolInvocationEvaluationRecord,
>(
  args: ToolInvocationEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = TOOL_INVOCATION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
