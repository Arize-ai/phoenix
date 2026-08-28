import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** The three inputs every evaluator receives. */
export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

type BySlot<T> = Record<
  ProjectEvaluatorMappingSourceGrain,
  Record<EvaluatorSlotName, T>
>;

/**
 * What a slot reads when its own path is left empty, written as a path the
 * author could have typed themselves — so the ghost text in the field is in
 * the same notation as anything they would replace it with.
 */
export type EvaluatorSlotDefault = { path: string };

/**
 * Each slot's default, as the field's ghost text shows it.
 *
 * An unmapped slot stores nothing and binds the context key of the same name,
 * so every default is that key itself. `input` and `output` are independent
 * bindings the context carries at its top level, not shorthand for a record
 * field, and the ghost says so rather than naming a `metadata.…` path that
 * happens to hold the same value. Which record field each one came from is
 * taught by the sampled value beside the row, not by the default.
 */
const SLOT_DEFAULTS: BySlot<EvaluatorSlotDefault> = {
  span: {
    input: { path: "input" },
    output: { path: "output" },
    metadata: { path: "metadata" },
  },
  session: {
    input: { path: "input" },
    output: { path: "output" },
    metadata: { path: "metadata" },
  },
};

/** A pinned example path and the one line shown beside it when highlighted. */
export type EvaluatorSlotSuggestedPath = {
  path: string;
  description: string;
};

/**
 * Paths pinned above the context's own field list while a slot is still
 * unmapped — worked examples of what a mapping can reach, from the plain
 * narrowing to the deeper cuts an author would otherwise have to discover
 * by drilling. Each is offered only when it resolves on the sampled record,
 * so nothing here can suggest a path that would fail.
 */
const SLOT_SUGGESTED_PATHS: BySlot<readonly EvaluatorSlotSuggestedPath[]> = {
  span: {
    input: [
      {
        path: "metadata.attributes.llm.input_messages",
        description: "Chat messages sent to the model.",
      },
      {
        path: "metadata.attributes.input",
        description: "Input attribute, with mime type.",
      },
    ],
    output: [
      {
        path: "metadata.attributes.llm.output_messages",
        description: "Messages the model returned.",
      },
    ],
    metadata: [
      {
        path: "metadata.attributes",
        description: "The whole attribute tree.",
      },
      {
        path: "metadata.attributes.llm",
        description: "Model, token counts, and messages.",
      },
      {
        path: "metadata.annotations",
        description: "Span annotations, by name.",
      },
    ],
  },
  session: {
    input: [
      {
        path: "metadata.turns",
        description: "Every turn, oldest first.",
      },
      {
        path: "metadata.turns[0].input",
        description: "The session's opening request.",
      },
    ],
    output: [
      {
        path: "metadata.turns[0].output",
        description: "The first turn's response.",
      },
    ],
    metadata: [],
  },
};

export function getEvaluatorSlotDefault(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): EvaluatorSlotDefault {
  return SLOT_DEFAULTS[grain][slotName];
}

/** All slot defaults for one project-evaluator record kind. */
export function getEvaluatorSlotDefaults(
  grain: ProjectEvaluatorMappingSourceGrain
): Readonly<Record<EvaluatorSlotName, EvaluatorSlotDefault>> {
  return SLOT_DEFAULTS[grain];
}

export function getEvaluatorSlotSuggestedPaths(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): readonly EvaluatorSlotSuggestedPath[] {
  return SLOT_SUGGESTED_PATHS[grain][slotName];
}
