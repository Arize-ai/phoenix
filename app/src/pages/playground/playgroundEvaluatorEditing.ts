import type { EvaluatorKind } from "@phoenix/types";

/**
 * The evaluator whose edit slideover is currently open, owned by
 * `PlaygroundDatasetSection` so both the per-item Edit affordance and the agent's
 * `open_dataset_evaluator_for_edit` client action drive the same slideover.
 */
export type EditingEvaluator = {
  datasetEvaluatorId: string;
  kind: EvaluatorKind;
  isBuiltIn: boolean;
};
