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

/**
 * Root fields pinned above the record's own field list while a slot is still
 * unmapped — the narrowing an author reaches for often enough that finding it
 * by drilling is the slower path.
 *
 * A session's fields carry no comparable shortcut, so its slots pin nothing.
 */
const SLOT_SUGGESTED_KEYS: BySlot<readonly string[]> = {
  span: {
    input: ["input_value"],
    output: ["output_value"],
    metadata: [],
  },
  session: {
    input: [],
    output: [],
    metadata: [],
  },
};

export function getEvaluatorSlotDefault(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): EvaluatorSlotDefault {
  return SLOT_DEFAULTS[grain][slotName];
}

export function getEvaluatorSlotSuggestedKeys(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): readonly string[] {
  return SLOT_SUGGESTED_KEYS[grain][slotName];
}
