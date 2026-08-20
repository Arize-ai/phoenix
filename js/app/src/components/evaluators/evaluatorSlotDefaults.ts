import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** The three inputs every evaluator receives. */
export const EVALUATOR_SLOT_NAMES = ["input", "output", "metadata"] as const;

export type EvaluatorSlotName = (typeof EVALUATOR_SLOT_NAMES)[number];

type SlotStrings<T> = Record<
  ProjectEvaluatorMappingSourceGrain,
  Record<EvaluatorSlotName, T>
>;

/**
 * The path each slot reads when its own path is left empty.
 *
 * Shown in the field as ghost text, which is where a slot's default is
 * documented — an unmapped slot stores nothing, so this is the only place the
 * value it will resolve to is written down.
 */
const SLOT_DEFAULT_PATHS: SlotStrings<string> = {
  span: {
    input: "span",
    output: "output",
    metadata: "metadata",
  },
  session: {
    input: "session",
    output: "output",
    metadata: "metadata",
  },
};

/**
 * Root fields pinned above the record's own field list while a slot is still
 * unmapped — the narrowing an author reaches for often enough that finding it
 * by drilling is the slower path.
 *
 * A session's fields carry no comparable shortcut, so its slots pin nothing.
 */
const SLOT_SUGGESTED_KEYS: SlotStrings<readonly string[]> = {
  span: {
    input: ["input_value"],
    output: [],
    metadata: [],
  },
  session: {
    input: [],
    output: [],
    metadata: [],
  },
};

export function getEvaluatorSlotDefaultPath(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): string {
  return SLOT_DEFAULT_PATHS[grain][slotName];
}

export function getEvaluatorSlotSuggestedKeys(
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName
): readonly string[] {
  return SLOT_SUGGESTED_KEYS[grain][slotName];
}
