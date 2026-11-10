import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import type { EvaluatorToDelete } from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import { useDeleteDatasetEvaluators } from "@phoenix/pages/dataset/evaluators/useDeleteDatasetEvaluators";

export type DeleteDatasetEvaluatorDialogProps = {
  datasetEvaluators: ReadonlyArray<EvaluatorToDelete>;
  /**
   * The dataset every evaluator belongs to. Without it the evaluators may
   * belong to any dataset.
   */
  datasetId?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onDeleted?: () => void;
  updateConnectionIds?: ReadonlyArray<string>;
};

export function DeleteDatasetEvaluatorDialog({
  datasetEvaluators,
  datasetId,
  isOpen,
  onOpenChange,
  onDeleted,
  updateConnectionIds,
}: DeleteDatasetEvaluatorDialogProps) {
  const { deleteDatasetEvaluators, isDeleting } = useDeleteDatasetEvaluators();
  return (
    <DeleteEvaluatorDialog
      evaluators={datasetEvaluators}
      target={datasetId ? "dataset" : "anyDataset"}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      isDeleting={isDeleting}
      onDelete={({ deleteAssociatedPromptOrDecision }) =>
        deleteDatasetEvaluators({
          datasetEvaluatorIds: datasetEvaluators.map(({ id }) => id),
          deleteAssociatedPromptOrDecision,
          connectionIds: updateConnectionIds,
          datasetId,
        })
      }
    />
  );
}
