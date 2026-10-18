/**
 * The only place phoenix-evals calls the AI SDK's experimental decision API.
 * `experimental_decide` and the decision model spec may change in AI SDK
 * patch releases, so keep everything that depends on their shape in here.
 */
import { experimental_decide } from "ai";

import { getTelemetryOptions } from "../telemetry";
import type { ClassificationResult } from "../types/evals";
import type { TelemetryConfig } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import type { DecisionModel } from "../utils/isDecisionModel";
import { promptToDecisionState } from "./decisionPrompt";

/**
 * The ID of the single choice question asked per classification.
 */
const QUESTION_ID = "label";

/**
 * The question's instructions. The rendered prompt, rubric included, is sent
 * as the state.
 */
const INSTRUCTIONS =
  "Read the prompt in the state and answer it by selecting exactly one of the choices.";

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
  prompt: WithPrompt;
  telemetry?: TelemetryConfig;
}): Promise<ClassificationResult> {
  const { model, labels, prompt, telemetry } = args;
  const result = await experimental_decide({
    model,
    state: promptToDecisionState(prompt),
    questions: {
      [QUESTION_ID]: {
        type: "choice",
        instructions: INSTRUCTIONS,
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
 * The decision model spec has no confidence field, but providers that
 * report one (OpenAI, TypeSafe) put it in their provider metadata as
 * `confidence[questionId]`.
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
