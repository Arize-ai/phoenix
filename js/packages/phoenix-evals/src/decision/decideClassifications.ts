/**
 * The multi-criterion counterpart of {@link decideClassification}. Asks every
 * criterion as its own choice question in a single `experimental_decide` call,
 * so a decision model answers them all at once.
 */
import { experimental_decide } from "ai";

import { getTelemetryOptions } from "../telemetry";
import type {
  ClassificationCriterion,
  NamedClassificationResult,
} from "../types/evals";
import type { TelemetryConfig } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import type { DecisionModel } from "../utils/isDecisionModel";
import { promptToDecisionState } from "./decisionPrompt";
import { getDecisionConfidence } from "./getDecisionConfidence";

/**
 * A single-choice decision question whose options are a criterion's labels.
 */
interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, null>;
}

/**
 * Classify several criteria with an AI SDK decision model. Each criterion
 * becomes one choice question (keyed by its name) in one decision call, and
 * the answers are split back into one result per criterion, in the order
 * given. Decision models don't generate text, so results have no explanation;
 * per-criterion label probabilities, the provider's confidence (when it
 * reports one) and the resolved model ID go in each result's metadata.
 *
 * A refusal throws the AI SDK's `Experimental_DecisionRefusalError`.
 */
export async function decideClassifications(args: {
  model: DecisionModel;
  criteria: readonly ClassificationCriterion[];
  prompt: WithPrompt;
  telemetry?: TelemetryConfig;
}): Promise<NamedClassificationResult[]> {
  const { model, criteria, prompt, telemetry } = args;
  const questions: Record<string, ChoiceQuestion> = Object.fromEntries(
    criteria.map((criterion) => [
      criterion.name,
      {
        type: "choice",
        instructions: criterion.instruction,
        criteria: Object.fromEntries(
          criterion.labels.map((label) => [label, null])
        ),
      } satisfies ChoiceQuestion,
    ])
  );
  const result = await experimental_decide({
    model,
    state: promptToDecisionState(prompt),
    questions,
    telemetry: getTelemetryOptions({
      functionId: "decideClassifications",
      telemetry,
    }),
  });
  return criteria.map((criterion) => {
    const answer = result.answers[criterion.name];
    if (!answer) {
      throw new Error(
        `The decision model returned no answer for criterion '${criterion.name}'.`
      );
    }
    const confidence = getDecisionConfidence({
      providerMetadata: result.providerMetadata,
      questionId: criterion.name,
    });
    return {
      name: criterion.name,
      label: answer.choice,
      metadata: {
        probabilities: answer.probabilities,
        ...(confidence !== undefined ? { confidence } : {}),
        modelId: result.response.modelId,
      },
    };
  });
}
