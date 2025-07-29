import { ClassificationResult, WithLLM } from "../types/evals";
import { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import { generateObject } from "ai";
import { z } from "zod";
import { tracer } from "../telemetry";
export interface ClassifyArgs extends WithLLM, WithPrompt, WithTelemetry {
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
}
/**
 * A function that leverages an llm to perform a classification
 */
export async function generateClassification(
  args: ClassifyArgs
): Promise<ClassificationResult> {
  const { labels, model, schemaName, schemaDescription, telemetry, ...prompt } =
    args;

  const experimental_telemetry = {
    isEnabled: telemetry?.isEnabled ?? true,
    functionId: "generateClassification",
    tracer: telemetry?.tracer ?? tracer,
  };

  const result = await generateObject({
    model,
    schemaName,
    schemaDescription,
    schema: z.object({
      explanation: z.string(), // We place the explanation in hopes it uses reasoning to explain the label.
      label: z.enum(labels),
    }),
    experimental_telemetry,
    ...prompt,
  });
  return {
    label: result.object.label,
    explanation: result.object.explanation,
  };
}
