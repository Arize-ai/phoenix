import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";

export const EVALUATOR_SLOT_IDS = ["A", "B", "C", "D"] as const;
export type SlotId = (typeof EVALUATOR_SLOT_IDS)[number];

export function getVisibleEvaluatorSlots(params: URLSearchParams): SlotId[] {
  const selected = params.getAll("evaluatorSlot");
  const slots = EVALUATOR_SLOT_IDS.filter((slot) => selected.includes(slot));
  return slots.length
    ? slots
    : params.get("compare") === "true"
      ? ["A", "B"]
      : ["A"];
}

export function setVisibleEvaluatorSlots(
  params: URLSearchParams,
  slots: readonly SlotId[]
) {
  params.delete("evaluatorSlot");
  params.delete("compare");
  slots.forEach((slot) => params.append("evaluatorSlot", slot));
}

export type SlotSnapshot = {
  revision: string;
  isDirty: boolean;
  name: string;
  outputNames: { name: string; labels: string[] }[];
  selectedOutputName: string;
  preview: EvaluatorPreviewInput | null;
  inputMapping: {
    literalMapping: Record<string, unknown>;
    pathMapping: Record<string, string>;
  };
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
   * Runs this slot on its own. Only offered while comparing — with a single
   * slot the page-level Run button is the one way to run it.
   */
  onRun?: () => void;
  /**
   * Removes this slot from the comparison. Any slot can be removed while more than one remains.
   */
  onRemove?: () => void;
  isRunning: boolean;
  isRunDisabled?: boolean;
  onSelectionChange?: (selection: {
    evaluatorId: string | null;
    datasetEvaluatorId: string | null;
  }) => void;
};

/** The position of a slot in the comparison, for the alphabetic index icon. */
export function getSlotIndex(slotId: SlotId): number {
  return EVALUATOR_SLOT_IDS.indexOf(slotId);
}
