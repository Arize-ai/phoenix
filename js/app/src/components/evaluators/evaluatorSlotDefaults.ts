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
export type EvaluatorSlotDefault = { kind: "path"; path: string };

/**
 * Each slot's default, as the field's ghost text shows it.
 *
 * An unmapped slot stores nothing and binds the context key of the same name,
 * so this is the only place the record field behind that key is written down.
 */
const SLOT_DEFAULTS: BySlot<EvaluatorSlotDefault> = {
  span: {
    input: { kind: "path", path: "metadata.span.input_value" },
    output: { kind: "path", path: "metadata.span.output_value" },
    metadata: { kind: "path", path: "metadata" },
  },
  session: {
    input: { kind: "path", path: "metadata.first_input" },
    output: { kind: "path", path: "metadata.last_output" },
    metadata: { kind: "path", path: "metadata" },
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
        path: "metadata.span.input_value",
        description: "The span's raw input value.",
      },
      {
        path: "metadata.span.attributes.llm.input_messages",
        description: "The chat messages sent to the model.",
      },
      {
        path: "metadata.span.attributes.input",
        description: "The input attribute, with its mime type.",
      },
    ],
    output: [
      {
        path: "metadata.span.output_value",
        description: "The span's raw output value.",
      },
      {
        path: "metadata.span.attributes.llm.output_messages",
        description: "The messages the model returned.",
      },
    ],
    metadata: [
      {
        path: "metadata.span.attributes",
        description: "The span's whole attribute tree.",
      },
      {
        path: "metadata.span.attributes.llm",
        description: "Model, token counts, and messages.",
      },
    ],
  },
  session: {
    input: [
      {
        path: "metadata.session.turns",
        description: "Every turn of the session, in order.",
      },
      {
        path: "metadata.session.turns[0].input",
        description: "The session's opening request.",
      },
    ],
    output: [
      {
        path: "metadata.session.turns[0].output",
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
