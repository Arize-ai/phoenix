import { experimental_evaluate, generateObject } from "ai";
import { z } from "zod";

import { getTelemetryIntegrations, tracer } from "../telemetry";
import type { ClassificationResult, WithLLM } from "../types/evals";
import type { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import { type EvaluationModel, isEvaluationModel } from "../utils";

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
 * When given an AI SDK evaluation model (e.g. TypeSafe's Jev) the
 * classification is routed through `experimental_evaluate` as a single
 * choice question. Evaluation models cannot generate text, so no explanation
 * is returned in that case.
 */
export async function generateClassification(
  args: ClassifyArgs
): Promise<ClassificationResult> {
  const { labels, model, schemaName, schemaDescription, telemetry, ...prompt } =
    args;

  if (isEvaluationModel(model)) {
    return evaluateClassification({ model, labels, prompt });
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

type EvaluationState = Parameters<typeof experimental_evaluate>[0]["state"];

/**
 * Classify using an AI SDK evaluation model. The rendered prompt becomes the
 * shared evaluation state and the labels become the options of one choice
 * question.
 */
async function evaluateClassification(args: {
  model: EvaluationModel;
  labels: [string, ...string[]];
  prompt: WithPrompt;
}): Promise<ClassificationResult> {
  const { model, labels, prompt } = args;
  const result = await experimental_evaluate({
    model,
    state: toEvaluationState(prompt),
    questions: {
      label: {
        type: "choice",
        instructions:
          "Read the prompt in the state and answer it by selecting exactly one of the choices.",
        criteria: Object.fromEntries(labels.map((label) => [label, null])),
      },
    },
  });
  return { label: result.answers.label.choice };
}

/**
 * Convert an AI SDK prompt into JSON-compatible evaluation state.
 * A plain text prompt is passed through as a string; anything else
 * (system messages, message arrays) is serialized to JSON.
 */
function toEvaluationState(prompt: WithPrompt): EvaluationState {
  const { system, messages } = prompt;
  const text = "prompt" in prompt ? prompt.prompt : undefined;
  if (
    typeof text === "string" &&
    system === undefined &&
    messages === undefined
  ) {
    return text;
  }
  const state: Record<string, unknown> = {};
  if (system !== undefined) state.system = system;
  if (text !== undefined) state.prompt = text;
  if (messages !== undefined) state.messages = messages;
  // Drop anything that is not JSON-compatible (e.g. binary file parts).
  return JSON.parse(JSON.stringify(state)) as EvaluationState;
}
