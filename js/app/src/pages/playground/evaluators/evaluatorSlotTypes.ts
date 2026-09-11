import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import type { EvaluatorInputMapping } from "@phoenix/types";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";

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

/**
 * One output of a slot's evaluator, reduced to what the results table needs
 * to render and validate an expected output against it: the allowed labels
 * and their configured scores for a categorical output, the bounds for a
 * continuous one.
 */
export type SlotOutput = {
  name: string;
  labels: string[];
  labelScores: Partial<Record<string, number>>;
  lowerBound: number | null;
  upperBound: number | null;
};

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

export type EvaluatorSlotProps = {
  registerAgentSlot?: (slot: SlotId, host: EvaluatorAgentSlot) => () => void;
  slotId: SlotId;
  datasetId: string | null;
  initialEvaluatorId?: string | null;
  initialDatasetEvaluatorId?: string | null;
  sampleContext: {
    input: unknown;
    output: unknown;
    reference: unknown;
    metadata: unknown;
  };
  onChange: (snapshot: SlotSnapshot) => void;
  /**
   * Removes this slot from the comparison. Any slot can be removed while more than one remains.
   */
  onRemove?: () => void;
  isRunning: boolean;
  onSelectionChange?: (selection: {
    evaluatorId: string | null;
    datasetEvaluatorId: string | null;
  }) => void;
};

/** The position of a slot in the comparison, for the alphabetic index icon. */
export function getSlotIndex(slotId: SlotId): number {
  return EVALUATOR_SLOT_IDS.indexOf(slotId);
}
