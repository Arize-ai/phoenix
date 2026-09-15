import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import type { EvaluatorInputMapping } from "@phoenix/types";

import type { EvaluatorOutput, ExpectedOutput } from "./evaluatorResults";

export const EVALUATOR_SLOT_IDS = ["A", "B", "C", "D"] as const;

export type SlotId = (typeof EVALUATOR_SLOT_IDS)[number];

/** The slots the URL shows, in A–D order; slot A alone when it names none. */
export function getVisibleEvaluatorSlots(params: URLSearchParams): SlotId[] {
  const selected = params.getAll("evaluatorSlot");
  const slots = EVALUATOR_SLOT_IDS.filter((slot) => selected.includes(slot));

  return slots.length ? slots : ["A"];
}

export function setVisibleEvaluatorSlots(
  params: URLSearchParams,
  slots: readonly SlotId[]
) {
  params.delete("evaluatorSlot");
  slots.forEach((slot) => params.append("evaluatorSlot", slot));
}

/** A slot's output, in the shape the results cells describe an output. */
export type SlotOutput = EvaluatorOutput;

export type SlotExpectations = Partial<
  Record<SlotId, Partial<Record<string, ExpectedOutput>>>
>;

export type SlotSnapshot = {
  revision: string;
  isDirty: boolean;
  kind: "LLM" | "CODE";
  name: string;
  outputNames: SlotOutput[];
  selectedOutputName: string;
  preview: EvaluatorPreviewInput | null;
  inputMapping: EvaluatorInputMapping;
  validationError: string | null;
};

/** The position of a slot in the comparison, for the alphabetic index icon. */
export function getSlotIndex(slotId: SlotId): number {
  return EVALUATOR_SLOT_IDS.indexOf(slotId);
}
