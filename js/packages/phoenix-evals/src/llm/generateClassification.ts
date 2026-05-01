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
     * If false, the LLM is asked only for a label, not an explanation.
     * Defaults to true.
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

  // Field order matters: when explanations are included, `explanation` must
  // come before `label` so the LLM generates its rationale first and uses it
  // to inform the label (chain-of-thought). Vercel AI SDK propagates Zod
  // field-insertion order into the JSON schema and into the structured-output
  // token order for OpenAI / Anthropic. Do not reorder.
  const schema = includeExplanation
    ? z.object({
        explanation: z.string(),
        label: z.enum(labels),
      })
    : z.object({
        label: z.enum(labels),
      });

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
