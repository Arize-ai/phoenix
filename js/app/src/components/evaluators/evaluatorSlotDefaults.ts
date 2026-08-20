import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** The three inputs every evaluator receives. */
export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

type BySlot<T> = Record<
  ProjectEvaluatorMappingSourceGrain,
  Record<EvaluatorSlotName, T>
>;

/**
 * What a slot reads when its own path is left empty.
 *
 * A `path` default is one the author could have written themselves, so it
 * shows in the notation they would have written it in. A `derived` default is
 * assembled from the record rather than read off it and no path expresses it,
 * so it is described instead — never in path notation, which would invite an
 * author to type something that resolves to nothing. `null` is no default at
 * all: an unmapped slot binds nothing, and an evaluator that names it fails
 * validation rather than quietly receiving something.
 */
export type EvaluatorSlotDefault =
  | { kind: "path"; path: string }
  | { kind: "derived"; description: string }
  | null;

/**
 * Each slot's default, as the field's ghost text shows it.
 *
 * An unmapped slot stores nothing, so this is the only place the value it
 * resolves to is written down.
 */
const SLOT_DEFAULTS: BySlot<EvaluatorSlotDefault> = {
  span: {
    input: { kind: "path", path: "span" },
    output: { kind: "path", path: "span.output_value" },
    metadata: null,
  },
  session: {
    input: { kind: "path", path: "session" },
    output: { kind: "derived", description: "last turn's output" },
    metadata: null,
  },
};

/** A pinned example path and the one line shown beside it when highlighted. */
export type EvaluatorSlotSuggestedPath = {
  path: string;
  description: string;
};

/**
 * Paths pinned above the record's own field list while a slot is still
 * unmapped — worked examples of what a mapping can reach, from the plain
 * narrowing to the deeper cuts an author would otherwise have to discover
 * by drilling. Root-relative; each is offered only when it resolves on the
 * sampled record, so nothing here can suggest a path that would fail.
 */
const SLOT_SUGGESTED_PATHS: BySlot<readonly EvaluatorSlotSuggestedPath[]> = {
  span: {
    input: [
      { path: "input_value", description: "The span's raw input value." },
      {
        path: "attributes.llm.input_messages",
        description: "The chat messages sent to the model.",
      },
      {
        path: "attributes.input",
        description: "The input attribute, with its mime type.",
      },
    ],
    output: [
      { path: "output_value", description: "The span's raw output value." },
      {
        path: "attributes.llm.output_messages",
        description: "The messages the model returned.",
      },
    ],
    metadata: [
      { path: "attributes", description: "The span's whole attribute tree." },
      {
        path: "attributes.llm",
        description: "Model, token counts, and messages.",
      },
    ],
  },
  session: {
    input: [
      { path: "turns", description: "Every turn of the session, in order." },
      { path: "turns[0].input", description: "The session's opening request." },
    ],
    output: [
      { path: "turns[0].output", description: "The first turn's response." },
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

export function getEvaluatorSlotSuggestedPaths(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): readonly EvaluatorSlotSuggestedPath[] {
  return SLOT_SUGGESTED_PATHS[grain][slotName];
}
