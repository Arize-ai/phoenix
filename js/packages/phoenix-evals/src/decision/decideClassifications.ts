/**
 * The multi-criterion counterpart of {@link decideClassification}. Asks every
 * criterion as its own choice question in a single `experimental_decide` call,
 * so a decision model answers them all at once.
 */
import { Experimental_DecisionRefusalError, experimental_decide } from "ai";

import { getTelemetryOptions } from "../telemetry";
import type {
  ClassificationCriterion,
  NamedClassificationOutcome,
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
 * Fault isolation: the AI SDK throws a single `Experimental_DecisionRefusalError`
 * for the whole call when the model refuses, so a refusal is reported as a
 * `refusal` failure for every criterion; a criterion the model simply leaves
 * unanswered becomes an `error` failure for that criterion alone.
 */
export async function decideClassifications(args: {
  model: DecisionModel;
  criteria: readonly ClassificationCriterion[];
  prompt: WithPrompt;
  telemetry?: TelemetryConfig;
}): Promise<NamedClassificationOutcome[]> {
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
  let result;
  try {
    result = await experimental_decide({
      model,
      state: promptToDecisionState(prompt),
      questions,
      telemetry: getTelemetryOptions({
        functionId: "decideClassifications",
        telemetry,
      }),
    });
  } catch (error) {
    if (error instanceof Experimental_DecisionRefusalError) {
      return criteria.map((criterion) => ({
        name: criterion.name,
        kind: "refusal",
        reason: error.message,
      }));
    }
    throw error;
  }
  return criteria.map((criterion) => {
    const answer = result.answers[criterion.name];
    if (!answer) {
      return {
        name: criterion.name,
        kind: "error",
        reason: `The decision model returned no answer for criterion '${criterion.name}'.`,
      };
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
