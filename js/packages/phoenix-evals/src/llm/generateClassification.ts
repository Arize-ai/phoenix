import {
  ClassificationEvaluationResult,
  LLMEvaluationArgs,
} from "../types/evals";
import type { Prompt } from "../types/prompts";
import { generateObject } from "ai";
import { z } from "zod";

interface ClassifyArgs<OutputType, InputType>
  extends LLMEvaluationArgs<OutputType, InputType> {
  /**
   * The labels to classify the example into. E.x. ["correct", "incorrect"]
   */
  labels: [string, ...string[]];
  /**
   * The prompt to use for generating the label and explanation.
   */
  prompt: Prompt;
  /**
   * The name of the schema for generating the label and explanation.
   */
  schemaName?: string;
  /**
   * The description of the schema for generating the label and explanation.
   */
  schemaDescription?: string;
}
/**
 * A function that leverages an llm to perform a classification
 */
export async function generateClassification<OutputType, InputType>(
  args: ClassifyArgs<OutputType, InputType>
): Promise<ClassificationEvaluationResult> {
  const { labels, model, schemaName, schemaDescription, prompt } = args;

  const result = await generateObject({
    model,
    schemaName,
    schemaDescription,
    schema: z.object({
      explanation: z.string(), // We place the explanation in hopes it uses reasoning to explain the label.
      label: z.enum(labels),
    }),
    ...prompt,
  });
  return {
    label: result.object.label,
    explanation: result.object.explanation,
  };
}
