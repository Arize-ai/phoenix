import { generateObject } from "ai";
import { z } from "zod";

import { decideClassification } from "../decision/decideClassification";
import { renderedPromptToDecisionPrompt } from "../decision/decisionPrompt";
import { getTelemetryIntegrations, tracer } from "../telemetry";
import type { ClassificationResult, WithLLM } from "../types/evals";
import type { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import { isDecisionModel } from "../utils/isDecisionModel";

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
  };
/**
 * A function that leverages an llm to perform a classification
 *
 * When given an AI SDK decision model (e.g. `openai.decisionModel("gpt-6-luna")`)
 * the classification is routed through `experimental_decide` as a single
 * choice question, with the prompt sent as plain text. Decision models cannot
 * generate text, so no explanation is returned in that case, and
 * `schemaName` / `schemaDescription` are ignored.
 */
export async function generateClassification(
  args: ClassifyArgs
): Promise<ClassificationResult> {
  const { labels, model, schemaName, schemaDescription, telemetry, ...prompt } =
    args;

  if (isDecisionModel(model)) {
    return decideClassification({
      model,
      labels,
      prompt: renderedPromptToDecisionPrompt(prompt),
      telemetry,
    });
  }

  const telemetryOptions = {
    isEnabled: telemetry?.isEnabled ?? true,
    functionId: "generateClassification",
    integrations: getTelemetryIntegrations(telemetry?.tracer ?? tracer),
  };

  const result = await generateObject({
    model,
    schemaName,
    schemaDescription,
    schema: z.object({
      explanation: z.string(), // We place the explanation in hopes it uses reasoning to explain the label.
      label: z.enum(labels),
    }),
    telemetry: telemetryOptions,
    // AI SDK 7 rejects system messages inside `messages` by default; keep
    // accepting them since prompt templates may include system messages.
    allowSystemInMessages: true,
    ...prompt,
  });
  return {
    label: result.object.label,
    explanation: result.object.explanation,
  };
}
