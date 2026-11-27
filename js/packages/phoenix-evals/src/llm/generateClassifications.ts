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
 * Build the schema for a criterion's label. Without descriptions this is a
 * plain `enum`, which providers accept under strict structured output. With
 * descriptions it is a union of described `const`s (a `oneOf`), so the model
 * sees what each label means.
 */
function buildLabelSchema(labels: Record<string, Description>): z.ZodTypeAny {
  const entries = Object.entries(labels);
  const names = entries.map(([name]) => name) as [string, ...string[]];
  const hasDescriptions = entries.some(
    ([, description]) => description != null
  );
  if (!hasDescriptions || names.length < 2) {
    return z.enum(names);
  }
  const literals: z.ZodTypeAny[] = entries.map(([name, description]) =>
    description != null
      ? z.literal(name).describe(description)
      : z.literal(name)
  );
  return z.union(
    literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]
  );
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
      criteria.map((criterion) => {
        const inner = z.object({
          // The explanation precedes the label so the model reasons before committing.
          explanation: z.string(),
          label: buildLabelSchema(criterion.labels),
        });
        return [
          criterion.name,
          criterion.instruction ? inner.describe(criterion.instruction) : inner,
        ];
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
    if (!answer) {
      return {
        name: criterion.name,
        kind: "error",
        reason: `The model returned no answer for criterion '${criterion.name}'.`,
      };
    }
    return {
      name: criterion.name,
      // The label schema is an enum/union of string literals, so this is a string.
      label: answer.label as string,
      explanation: answer.explanation,
    };
  });
}
