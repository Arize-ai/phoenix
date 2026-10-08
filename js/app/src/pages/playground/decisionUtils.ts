import { z } from "zod";

import {
  DEFAULT_CHOICE_CRITERIA,
  DEFAULT_DECISION_STATE,
} from "@phoenix/constants/decisionConstants";
import type { PlaygroundInstance } from "@phoenix/store/playground/types";

export type DecisionDraft = NonNullable<PlaygroundInstance["decision"]>;
export type DecisionQuestionDraft = DecisionDraft["questions"][number];

const descriptionSchema = z.union([
  z.string().min(1),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);
const choiceCriteriaSchema = z
  .record(z.string().min(1), descriptionSchema.nullable())
  .refine(
    (criteria) =>
      Object.keys(criteria).length >= 2 && Object.keys(criteria).length <= 255,
    "Choice requires 2–255 named options"
  );
const scoreCriteriaSchema = z.array(descriptionSchema).min(2).max(10);
const noulCriteriaSchema = z
  .object({
    true: descriptionSchema.optional(),
    false: descriptionSchema.optional(),
  })
  .strict();

export function createDecisionDraft(): DecisionDraft {
  return {
    state: DEFAULT_DECISION_STATE,
    stateFormat: "text",
    questions: [
      {
        id: crypto.randomUUID(),
        name: "department",
        type: "choice",
        instructions: "Which department should handle this request?",
        criteria: DEFAULT_CHOICE_CRITERIA,
      },
    ],
  };
}

/** Parse a draft without silently overwriting duplicate question names. */
export function buildDecisionInput(draft: DecisionDraft) {
  const state: unknown =
    draft.stateFormat === "json" ? JSON.parse(draft.state) : draft.state;
  descriptionSchema.parse(state);
  if (typeof state === "string" && !state.trim())
    throw new Error("State cannot be empty");
  if (!draft.questions.length) throw new Error("Add at least one question");
  const questions = new Map<
    string,
    {
      type: DecisionQuestionDraft["type"];
      instructions: string;
      criteria?: unknown;
    }
  >();
  for (const question of draft.questions) {
    const name = question.name.trim();
    if (!name) throw new Error("Question names cannot be empty");
    if (questions.has(name))
      throw new Error(`Question name '${name}' is duplicated`);
    if (!question.instructions.trim())
      throw new Error(`Instructions for '${name}' cannot be empty`);
    const criteria: unknown = question.criteria.trim()
      ? JSON.parse(question.criteria)
      : undefined;
    if (question.type === "choice") choiceCriteriaSchema.parse(criteria);
    if (question.type === "score") scoreCriteriaSchema.parse(criteria);
    if (question.type === "noul" && criteria !== undefined)
      noulCriteriaSchema.parse(criteria);
    questions.set(name, {
      type: question.type,
      instructions: question.instructions,
      ...(criteria !== undefined ? { criteria } : {}),
    });
  }
  return { state, questions: Object.fromEntries(questions) };
}

export function getDecisionValidationError(
  draft: DecisionDraft
): string | null {
  try {
    buildDecisionInput(draft);
    return null;
  } catch (error) {
    return error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join("; ")
      : error instanceof Error
        ? error.message
        : "Invalid decision input";
  }
}
