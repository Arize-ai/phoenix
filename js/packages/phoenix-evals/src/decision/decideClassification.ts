/**
 * The only place phoenix-evals calls the AI SDK's experimental decision API.
 * `experimental_decide` and the decision model spec may change in AI SDK
 * patch releases, so keep everything that depends on their shape in here.
 */
import { experimental_decide, Experimental_DecisionRefusalError } from "ai";

import { getTelemetryIntegrations, tracer } from "../telemetry";
import type { ClassificationResult } from "../types/evals";
import type { TelemetryConfig } from "../types/otel";
import type { DecisionModel } from "../utils/isDecisionModel";
import type { DecisionPrompt } from "./decisionPrompt";

/**
 * The OpenAI Decisions API accepts between 2 and 255 options per choice question.
 */
const MIN_LABELS = 2;
const MAX_LABELS = 255;

/**
 * The ID of the single choice question asked per classification.
 */
const QUESTION_ID = "label";

/**
 * Thrown when a decision model refuses to classify an example. Decision
 * models refuse when there is nothing to judge (e.g. an empty input), when
 * asked to infer sensitive attributes such as religion or sexual
 * orientation, or when the content shows intent to cause harm or evade
 * oversight. Short but non-empty inputs are usually still answered.
 */
export class ClassificationRefusalError extends Error {
  readonly modelId: string;
  constructor(args: { modelId: string; cause: unknown }) {
    super(
      `Decision model "${args.modelId}" refused to classify this example. ` +
        "Decision models refuse when the input is empty, asks them to infer " +
        "sensitive attributes, or shows intent to cause harm.",
      { cause: args.cause }
    );
    this.name = "ClassificationRefusalError";
    this.modelId = args.modelId;
  }
}

/**
 * Classify with an AI SDK decision model by asking one choice question whose
 * options are the labels. Decision models don't generate text, so the
 * result has no explanation. Label probabilities, the provider's confidence
 * (when it reports one) and the resolved model ID go in the metadata.
 */
export async function decideClassification(args: {
  model: DecisionModel;
  labels: readonly string[];
  prompt: DecisionPrompt;
  telemetry?: TelemetryConfig;
}): Promise<ClassificationResult> {
  const { model, labels, prompt, telemetry } = args;
  assertLabelCount(labels);
  let result;
  try {
    result = await experimental_decide({
      model,
      state: prompt.state,
      questions: {
        [QUESTION_ID]: {
          type: "choice",
          instructions: prompt.instructions,
          criteria: Object.fromEntries(labels.map((label) => [label, null])),
        },
      },
      telemetry: {
        isEnabled: telemetry?.isEnabled ?? true,
        functionId: "decideClassification",
        integrations: getTelemetryIntegrations(telemetry?.tracer ?? tracer),
      },
    });
  } catch (error) {
    if (Experimental_DecisionRefusalError.isInstance(error)) {
      throw new ClassificationRefusalError({
        modelId: model.modelId,
        cause: error,
      });
    }
    throw error;
  }
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

function assertLabelCount(labels: readonly string[]) {
  if (labels.length < MIN_LABELS || labels.length > MAX_LABELS) {
    throw new Error(
      `Decision models need between ${MIN_LABELS} and ${MAX_LABELS} choices, got ${labels.length}.`
    );
  }
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
