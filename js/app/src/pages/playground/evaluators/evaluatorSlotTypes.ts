import type { EvaluatorPreviewInput } from "@phoenix/components/evaluators/__generated__/EvaluatorOutputPreviewMutation.graphql";
import type { EvaluatorInputMapping } from "@phoenix/types";

import type { EvaluatorAgentSlot } from "./evaluatorAgentSlot";
import type { EvaluatorSlotSource } from "./evaluatorPlaygroundSource";
import type { EvaluatorSaveTarget } from "./evaluatorSaveTarget";

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
  /** What Save writes for this slot; fixed for the life of the loaded source. */
  saveTarget: EvaluatorSaveTarget;
};

/**
 * The first row's evaluation context, as the slot's input mapping UI reads it.
 * `grain` says which record vocabulary it speaks: an example, or a span whose
 * metadata keeps the span's `attributes`.
 */
export type EvaluatorSlotSampleContext = {
  grain: "dataset" | "span";
  input: unknown;
  output: unknown;
  reference: unknown;
  metadata: unknown;
};

/** The saved evaluator a slot was opened from, by URL param. */
export type EvaluatorSlotSelection = {
  evaluatorId: string | null;
  datasetEvaluatorId: string | null;
  projectEvaluatorId: string | null;
};

export type EvaluatorSlotProps = {
  registerAgentSlot?: (slot: SlotId, host: EvaluatorAgentSlot) => () => void;
  slotId: SlotId;
  /** The dataset or project the slot saves to; null before one is chosen. */
  source: EvaluatorSlotSource | null;
  /** Project source: the applied span filter in the Results strip. */
  sourceFilterCondition?: string;
  initialEvaluatorId?: string | null;
  initialDatasetEvaluatorId?: string | null;
  initialProjectEvaluatorId?: string | null;
  sampleContext: EvaluatorSlotSampleContext;
  onChange: (snapshot: SlotSnapshot) => void;
  /**
   * Removes this slot from the comparison. Any slot can be removed while more than one remains.
   */
  onRemove?: () => void;
  isRunning: boolean;
  onSelectionChange?: (selection: EvaluatorSlotSelection) => void;
};

/** The save options the dialog and the Save filter action can set. */
export type EvaluatorSlotSaveOptions = {
  asNew?: boolean;
  /** Project source only: the span filter to store on the project evaluator. */
  filterCondition?: string;
  /** Project source only: sampling rate as a fraction in [0, 1]. */
  samplingRate?: number;
};

/** The position of a slot in the comparison, for the alphabetic index icon. */
export function getSlotIndex(slotId: SlotId): number {
  return EVALUATOR_SLOT_IDS.indexOf(slotId);
}
