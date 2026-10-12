/**
 * The only place phoenix-evals calls the AI SDK's experimental decision API.
 * `experimental_decide` and the decision model spec may change in AI SDK
 * patch releases, so keep everything that depends on their shape in here.
 */
import { experimental_decide } from "ai";

import { getTelemetryOptions } from "../telemetry";
import type { ClassificationResult } from "../types/evals";
import type { TelemetryConfig } from "../types/otel";
import type { DecisionModel } from "../utils/isDecisionModel";
import type { DecisionPrompt } from "./decisionPrompt";

/**
 * The ID of the single choice question asked per classification.
 */
const QUESTION_ID = "label";

/**
 * Classify with an AI SDK decision model by asking one choice question whose
 * options are the labels. Decision models don't generate text, so the
 * result has no explanation. Label probabilities, the provider's confidence
 * (when it reports one) and the resolved model ID go in the metadata.
 *
 * Choice limits and refusals are left to the AI SDK and the provider: a
 * refusal throws the AI SDK's `Experimental_DecisionRefusalError`.
 */
export async function decideClassification(args: {
  model: DecisionModel;
  labels: readonly string[];
  prompt: DecisionPrompt;
  telemetry?: TelemetryConfig;
}): Promise<ClassificationResult> {
  const { model, labels, prompt, telemetry } = args;
  const result = await experimental_decide({
    model,
    state: prompt.state,
    questions: {
      [QUESTION_ID]: {
        type: "choice",
        instructions: prompt.instructions,
        criteria: Object.fromEntries(labels.map((label) => [label, null])),
      },
    },
    telemetry: getTelemetryOptions({
      functionId: "decideClassification",
      telemetry,
    }),
  });
  const answer = result.answers[QUESTION_ID];
  const confidence = getConfidence(result.providerMetadata);
  return {
    label: answer.choice,
    metadata: {
      probabilities: answer.probabilities,
      ...(confidence !== undefined ? { confidence } : {}),
      modelId: result.response.modelId,
    },
  };
}

/**
 * OpenAI reports a per-question confidence only in provider metadata.
 * For a two-way choice it is the margin between the two probabilities.
 */
function getConfidence(providerMetadata: unknown): number | undefined {
  if (typeof providerMetadata !== "object" || providerMetadata === null) {
    return undefined;
  }
  for (const metadata of Object.values(providerMetadata)) {
    const confidence = (metadata as { confidence?: Record<string, unknown> })
      ?.confidence?.[QUESTION_ID];
    if (typeof confidence === "number") return confidence;
  }
  return undefined;
}
