import { generateObject } from "ai";
import { z } from "zod";

import { tracer } from "../telemetry";
import type { ClassificationResult, WithLLM } from "../types/evals";
import type { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
export type ClassifyArgs = WithLLM &
  WithTelemetry &
  WithPrompt & {
    /**
     * The labels to classify the example into. E.x. ["correct", "incorrect"]
     */
    labels: [string, ...string[]];
    /**
     * The name of the schema for generating the label and explanation.
     */
    schemaName?: string;
    /**
     * The description of the schema for generating the label and explanation.
     */
    schemaDescription?: string;
    /**
     * Whether to ask for and parse an explanation in addition to the label.
     * Defaults to true for backwards-compatible classification behavior.
     */
    includeExplanation?: boolean;
  };
/**
 * A function that leverages an llm to perform a classification
 */
export async function generateClassification(
  args: ClassifyArgs
): Promise<ClassificationResult> {
  const {
    labels,
    model,
    schemaName,
    schemaDescription,
    telemetry,
    includeExplanation = true,
    ...prompt
  } = args;

  const experimental_telemetry = {
    isEnabled: telemetry?.isEnabled ?? true,
    functionId: "generateClassification",
    tracer: telemetry?.tracer ?? tracer,
  };

  const baseSchema = z.object({
    label: z.enum(labels),
  });
  const schema = includeExplanation
    ? baseSchema.extend({
        explanation: z.string(),
      })
    : baseSchema;

  const result = await generateObject({
    model,
    schemaName,
    schemaDescription,
    schema,
    experimental_telemetry,
    ...prompt,
  });
  const resultObject = result.object as ClassificationResult;
  return {
    label: resultObject.label,
    explanation: resultObject.explanation,
  };
}
