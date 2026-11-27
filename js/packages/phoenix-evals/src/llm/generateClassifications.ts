import { generateObject } from "ai";
import { z } from "zod";

import { decideClassifications } from "../decision/decideClassifications";
import { getTelemetryOptions } from "../telemetry";
import type {
  ClassificationCriterion,
  NamedClassificationOutcome,
  WithLLM,
} from "../types/evals";
import type { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import { isDecisionModel } from "../utils/isDecisionModel";

export type ClassifyCriteriaArgs = WithLLM &
  WithTelemetry &
  WithPrompt & {
    /**
     * The criteria to classify the input against. One result is returned per
     * criterion, in the order given.
     */
    criteria: [ClassificationCriterion, ...ClassificationCriterion[]];
  };

/**
 * Answer several named classification questions about one prompt in a single
 * request, returning one result per criterion.
 *
 * With a language model, all criteria are answered in one `generateObject`
 * call backed by a single nested schema (one property per criterion, keyed by
 * its name), and each criterion gets an explanation. When given an AI SDK
 * decision model the criteria are routed through `experimental_decide` as
 * multiple choice questions in one call; decision models cannot generate text,
 * so no explanation is returned in that case.
 *
 * Fault isolation: a criterion with no answer becomes a `ClassificationFailure`
 * for that criterion alone, so its siblings' answers are still returned.
 */
export async function generateClassifications(
  args: ClassifyCriteriaArgs
): Promise<NamedClassificationOutcome[]> {
  const { criteria, model, telemetry, ...prompt } = args;

  if (isDecisionModel(model)) {
    return decideClassifications({ model, criteria, prompt, telemetry });
  }

  const schema = z.object(
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.name,
        z
          .object({
            // The explanation precedes the label so the model reasons before committing.
            explanation: z.string(),
            label: z.enum(criterion.labels),
          })
          .describe(criterion.instruction),
      ])
    )
  );

  const result = await generateObject({
    model,
    schema,
    telemetry: getTelemetryOptions({
      functionId: "generateClassifications",
      telemetry,
    }),
    // AI SDK 7 rejects system messages inside `messages` by default; keep
    // accepting them since prompt templates may include system messages.
    allowSystemInMessages: true,
    ...prompt,
  });

  return criteria.map((criterion) => {
    const answer = result.object[criterion.name];
    if (!answer) {
      return {
        name: criterion.name,
        kind: "error",
        reason: `The model returned no answer for criterion '${criterion.name}'.`,
      };
    }
    return {
      name: criterion.name,
      label: answer.label,
      explanation: answer.explanation,
    };
  });
}
