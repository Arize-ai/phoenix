import type { EvaluatorSlotSource } from "./evaluatorPlaygroundSource";

/**
 * What Save writes for a slot, decided from the evaluator loaded into it and
 * the dataset or project the playground is on.
 *
 * - `update`: the evaluator is already on this dataset or project, so Save
 *   changes it in place, the way the prompt playground saves a new version of
 *   a loaded prompt. On a dataset any binding of the shared evaluator counts;
 *   on a project only the project evaluator the slot was opened from does.
 * - `attach`: a code evaluator that is not on this dataset or project yet.
 *   Code evaluators are shared, so Save updates the evaluator and adds it.
 * - `create`: a fresh draft, or an LLM evaluator that is not on this dataset
 *   or project. LLM evaluators have no attach mutation, so Save creates a copy
 *   here; the slot then points at the copy and later saves update it.
 */
export type EvaluatorSaveTarget =
  | { action: "create" }
  | { action: "attach"; evaluatorId: string }
  | { action: "update"; evaluatorId: string; datasetEvaluatorId: string }
  | { action: "update"; evaluatorId: string; projectEvaluatorId: string };

export type EvaluatorSaveSource = {
  id: string;
  kind: string;
  datasetEvaluators: readonly { id: string; dataset: { id: string } }[];
};

/** The dataset or project evaluator the slot was opened from. */
export type EvaluatorSaveBinding =
  | { kind: "dataset"; id: string; datasetId: string }
  | { kind: "project"; id: string; projectId: string };

export function isProjectEvaluatorUpdate(
  target: EvaluatorSaveTarget
): target is Extract<EvaluatorSaveTarget, { projectEvaluatorId: string }> {
  return target.action === "update" && "projectEvaluatorId" in target;
}

export function getEvaluatorSaveTarget({
  source,
  selectedBinding,
  playgroundSource,
}: {
  /** The shared evaluator loaded into the slot; null for a new draft. */
  source: EvaluatorSaveSource | null;
  selectedBinding: EvaluatorSaveBinding | null;
  playgroundSource: EvaluatorSlotSource | null;
}): EvaluatorSaveTarget {
  if (!source || !playgroundSource) return { action: "create" };

  if (playgroundSource.kind === "dataset") {
    const { datasetId } = playgroundSource;

    const datasetEvaluatorId =
      selectedBinding?.kind === "dataset" &&
      selectedBinding.datasetId === datasetId
        ? selectedBinding.id
        : source.datasetEvaluators.find(
            (binding) => binding.dataset.id === datasetId
          )?.id;

    if (datasetEvaluatorId)
      return { action: "update", evaluatorId: source.id, datasetEvaluatorId };
  } else if (
    selectedBinding?.kind === "project" &&
    selectedBinding.projectId === playgroundSource.projectId
  )
    return {
      action: "update",
      evaluatorId: source.id,
      projectEvaluatorId: selectedBinding.id,
    };

  return source.kind === "CODE"
    ? { action: "attach", evaluatorId: source.id }
    : { action: "create" };
}
