import { generateObject } from "ai";
import { z } from "zod";

import { decideClassifications } from "../decision/decideClassifications";
import { getTelemetryOptions } from "../telemetry";
import type {
  ClassificationCriterion,
  Description,
  NamedClassificationOutcome,
  WithLLM,
} from "../types/evals";
import type { WithTelemetry } from "../types/otel";
import type { WithPrompt } from "../types/prompts";
import { isDecisionModel } from "../utils/isDecisionModel";

/**
 * Render a criterion's labels as a human-readable list for the `label` field's
 * description, so the model sees the allowed labels and what each one means.
 * The labels are conveyed as text rather than as an enum/union so an off-list
 * label is returned for the caller to isolate instead of failing the whole
 * `generateObject` call (see {@link generateClassifications}).
 */
function formatAllowedLabels(labels: Record<string, Description>): string {
  return Object.entries(labels)
    .map(([name, description]) =>
      description != null ? `- "${name}": ${description}` : `- "${name}"`
    )
    .join("\n");
}

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
 * Fault isolation: each criterion is a nullable property whose `label` is a
 * free-form string, so the model can decline a criterion (null) or return an
 * off-list label without the single `generateObject` call being rejected. A
 * declined criterion becomes an `error` failure for that criterion alone; an
 * off-list label is returned verbatim for the caller to validate against the
 * criterion's labels. Siblings are unaffected either way.
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
      criteria.map((criterion) => {
        const inner = z.object({
          // The explanation precedes the label so the model reasons before committing.
          explanation: z.string(),
          label: z
            .string()
            .describe(
              `Respond with exactly one of these labels:\n${formatAllowedLabels(criterion.labels)}`
            ),
        });
        const described = criterion.instruction
          ? inner.describe(criterion.instruction)
          : inner;
        // Nullable (not optional) keeps the key required for strict structured
        // output providers while letting the model decline with null.
        return [criterion.name, described.nullable()];
      })
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
    if (answer == null) {
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
