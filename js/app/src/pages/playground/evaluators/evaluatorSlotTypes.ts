import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";

export type SlotId = "A" | "B";

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
   * Removes this slot from the comparison. Only the second slot is removable;
   * the first is the comparison baseline.
   */
  onRemove?: () => void;
  isRunning: boolean;
  isRunDisabled?: boolean;
  onSelectionChange?: (selection: {
    evaluatorId: string | null;
    datasetEvaluatorId: string | null;
  }) => void;
};

/** The position of a slot in the A/B pair, for the alphabetic index icon. */
export function getSlotIndex(slotId: SlotId): number {
  return slotId === "A" ? 0 : 1;
}
