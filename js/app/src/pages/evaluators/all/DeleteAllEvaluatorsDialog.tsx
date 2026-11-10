import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import type { EvaluatorToDelete } from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import { useDeleteDatasetEvaluators } from "@phoenix/pages/dataset/evaluators/useDeleteDatasetEvaluators";
import { useDeleteProjectEvaluators } from "@phoenix/pages/project/evaluators/useDeleteProjectEvaluators";

/**
 * Confirms deleting a mix of project and dataset evaluators, deleting each
 * type with its own mutation.
 */
export function DeleteAllEvaluatorsDialog({
  projectEvaluators,
  datasetEvaluators,
  isOpen,
  onOpenChange,
  onDeleted,
  onPartiallyDeleted,
}: {
  projectEvaluators: ReadonlyArray<EvaluatorToDelete>;
  datasetEvaluators: ReadonlyArray<EvaluatorToDelete>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted: () => void;
  /**
   * Called when one type was deleted and the other failed. The dialog stays
   * open with the error, so the list should refetch to drop the deleted rows.
   */
  onPartiallyDeleted: () => void;
}) {
  const { deleteProjectEvaluators, isDeleting: isDeletingProjectEvaluators } =
    useDeleteProjectEvaluators();
  const { deleteDatasetEvaluators, isDeleting: isDeletingDatasetEvaluators } =
    useDeleteDatasetEvaluators();
  const target =
    projectEvaluators.length === 0
      ? "anyDataset"
      : datasetEvaluators.length === 0
        ? "anyProject"
        : "anywhere";
  return (
    <DeleteEvaluatorDialog
      evaluators={[...projectEvaluators, ...datasetEvaluators]}
      target={target}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      isDeleting={isDeletingProjectEvaluators || isDeletingDatasetEvaluators}
      onDelete={async ({ deleteAssociatedPromptOrDecision }) => {
        const deletions: Promise<void>[] = [];
        if (projectEvaluators.length > 0) {
          deletions.push(
            deleteProjectEvaluators({
              projectEvaluatorIds: projectEvaluators.map(({ id }) => id),
              deleteAssociatedPromptOrDecision,
            })
          );
        }
        if (datasetEvaluators.length > 0) {
          deletions.push(
            deleteDatasetEvaluators({
              datasetEvaluatorIds: datasetEvaluators.map(({ id }) => id),
              deleteAssociatedPromptOrDecision,
            })
          );
        }
        const results = await Promise.allSettled(deletions);
        const failure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        );
        if (!failure) {
          return;
        }
        if (results.some((result) => result.status === "fulfilled")) {
          onPartiallyDeleted();
        }
        throw failure.reason instanceof Error
          ? failure.reason
          : new Error("Unable to remove evaluators");
      }}
    />
  );
}
