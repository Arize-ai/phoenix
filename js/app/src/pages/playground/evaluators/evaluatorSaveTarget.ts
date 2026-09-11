/**
 * What Save writes for a slot, decided from the evaluator loaded into it and
 * the dataset the playground is on.
 *
 * - `update`: the evaluator is already on this dataset, so Save changes it in
 *   place, the way the prompt playground saves a new version of a loaded prompt.
 * - `attach`: a code evaluator that is not on this dataset yet. Code evaluators
 *   are shared, so Save updates the evaluator and adds it to the dataset.
 * - `create`: a fresh draft, or an LLM evaluator that is not on this dataset.
 *   LLM evaluators have no attach mutation, so Save creates a copy on this
 *   dataset; the slot then points at the copy and later saves update it.
 */
export type EvaluatorSaveTarget =
  | { action: "create" }
  | { action: "attach"; evaluatorId: string }
  | { action: "update"; evaluatorId: string; datasetEvaluatorId: string };

export type EvaluatorSaveSource = {
  id: string;
  kind: string;
  datasetEvaluators: readonly { id: string; dataset: { id: string } }[];
};

export function getEvaluatorSaveTarget({
  source,
  selectedDatasetEvaluator,
  datasetId,
}: {
  /** The shared evaluator loaded into the slot; null for a new draft. */
  source: EvaluatorSaveSource | null;
  /** The binding loaded into the slot, when the slot was opened from one. */
  selectedDatasetEvaluator: { id: string; datasetId: string } | null;
  datasetId: string | null;
}): EvaluatorSaveTarget {
  if (!source || !datasetId) return { action: "create" };

  const bindingId =
    selectedDatasetEvaluator?.datasetId === datasetId
      ? selectedDatasetEvaluator.id
      : source.datasetEvaluators.find(
          (binding) => binding.dataset.id === datasetId
        )?.id;

  if (bindingId)
    return {
      action: "update",
      evaluatorId: source.id,
      datasetEvaluatorId: bindingId,
    };

  return source.kind === "CODE"
    ? { action: "attach", evaluatorId: source.id }
    : { action: "create" };
}
