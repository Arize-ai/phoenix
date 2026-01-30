import { TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG } from "../__generated__/default_templates";
import { CreateClassificationEvaluatorArgs } from "../types/evals";

import { ClassificationEvaluator } from "./ClassificationEvaluator";
import { createClassificationEvaluator } from "./createClassificationEvaluator";

export interface ToolSelectionEvaluatorArgs<
  RecordType extends Record<string, unknown> = ToolSelectionEvaluationRecord,
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
 * A record to be evaluated by the tool selection evaluator.
 */
export type ToolSelectionEvaluationRecord = {
  /**
   * The input query or conversation context.
   */
  input: string;
  /**
   * The available tools that the LLM could use.
   */
  availableTools: string;
  /**
   * The tool or tools selected by the LLM.
   */
  toolSelection: string;
};

/**
 * Creates a tool selection evaluator function.
 *
 * This function returns an evaluator that determines whether the correct tool
 * was selected for a given context. Unlike the tool invocation evaluator which
 * checks if the tool was called correctly with proper arguments, this evaluator
 * focuses on whether the right tool was chosen in the first place.
 *
 * The evaluator checks for:
 * - Whether the LLM chose the best available tool for the user query
 * - Whether the tool name exists in the available tools list
 * - Whether the correct number of tools were selected for the task
 * - Whether the tool selection is safe and appropriate
 *
 * @param args - The arguments for creating the tool selection evaluator.
 * @param args.model - The model to use for classification.
 * @param args.choices - The possible classification choices (defaults to correct/incorrect).
 * @param args.promptTemplate - The prompt template to use (defaults to TOOL_SELECTION_TEMPLATE).
 * @param args.telemetry - The telemetry to use for the evaluator.
 *
 * @returns An evaluator function that takes a {@link ToolSelectionEvaluationRecord} and returns
 * a classification result indicating whether the tool selection is correct or incorrect.
 *
 * @example
 * ```ts
 * const evaluator = createToolSelectionEvaluator({ model: openai("gpt-4o-mini") });
 *
 * const result = await evaluator.evaluate({
 *   input: "User: What is the weather in San Francisco?",
 *   availableTools: `WeatherTool: Get the current weather for a location.
 * NewsTool: Stay connected to global events with our up-to-date news around the world.
 * MusicTool: Create playlists, search for music, and check the latest music trends.`,
 *   toolSelection: "WeatherTool"
 * });
 * console.log(result.label); // "correct" or "incorrect"
 * ```
 */
export function createToolSelectionEvaluator<
  RecordType extends Record<string, unknown> = ToolSelectionEvaluationRecord,
>(
  args: ToolSelectionEvaluatorArgs<RecordType>
): ClassificationEvaluator<RecordType> {
  const {
    choices = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.choices,
    promptTemplate = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.template,
    optimizationDirection = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.optimizationDirection,
    name = TOOL_SELECTION_CLASSIFICATION_EVALUATOR_CONFIG.name,
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
