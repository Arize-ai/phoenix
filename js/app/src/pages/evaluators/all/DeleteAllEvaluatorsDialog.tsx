import { useRelayEnvironment } from "react-relay";

import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import type { EvaluatorToDelete } from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import { useDeleteDatasetEvaluators } from "@phoenix/pages/dataset/evaluators/useDeleteDatasetEvaluators";
import { refetchEvaluatorCounts } from "@phoenix/pages/evaluators/refetchEvaluatorCounts";
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
  const environment = useRelayEnvironment();
  const { deleteProjectEvaluators, isDeleting: isDeletingProjectEvaluators } =
    useDeleteProjectEvaluators();
  const { deleteDatasetEvaluators, isDeleting: isDeletingDatasetEvaluators } =
    useDeleteDatasetEvaluators();
  return (
    <DeleteEvaluatorDialog
      evaluators={[...projectEvaluators, ...datasetEvaluators]}
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
              refetchCounts: false,
            })
          );
        }
        if (datasetEvaluators.length > 0) {
          deletions.push(
            deleteDatasetEvaluators({
              datasetEvaluatorIds: datasetEvaluators.map(({ id }) => id),
              deleteAssociatedPromptOrDecision,
              refetchCounts: false,
            })
          );
        }
        const results = await Promise.allSettled(deletions);
        // Refetched once both deletes settle, so neither response can
        // overwrite the other's count with an older one.
        if (results.some((result) => result.status === "fulfilled")) {
          refetchEvaluatorCounts({ environment });
        }
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
          : new Error("Unable to delete evaluators");
      }}
    />
  );
}
