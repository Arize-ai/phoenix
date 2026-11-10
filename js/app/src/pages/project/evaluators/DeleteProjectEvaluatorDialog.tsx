import { useRelayEnvironment } from "react-relay";

import { useTimeRange } from "@phoenix/components/datetime";
import { DeleteEvaluatorDialog } from "@phoenix/components/evaluators/DeleteEvaluatorDialog";
import type { EvaluatorToDelete } from "@phoenix/components/evaluators/deleteEvaluatorsCopy";
import { refetchProjectEvaluators } from "@phoenix/pages/project/evaluators/refetchProjectEvaluators";
import { useDeleteProjectEvaluators } from "@phoenix/pages/project/evaluators/useDeleteProjectEvaluators";

export type DeleteProjectEvaluatorDialogProps = {
  projectEvaluators: ReadonlyArray<EvaluatorToDelete>;
  /**
   * The project every evaluator belongs to, whose evaluators are refetched
   * after the delete. Without it the evaluators may belong to any project and
   * the caller refetches from `onDeleted`.
   */
  projectId?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted?: () => void;
};

export function DeleteProjectEvaluatorDialog({
  projectEvaluators,
  projectId,
  isOpen,
  onOpenChange,
  onDeleted,
}: DeleteProjectEvaluatorDialogProps) {
  const environment = useRelayEnvironment();
  const { timeRangeISOStrings } = useTimeRange();
  const { deleteProjectEvaluators, isDeleting } = useDeleteProjectEvaluators();
  return (
    <DeleteEvaluatorDialog
      evaluators={projectEvaluators}
      target={projectId ? "project" : "anyProject"}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      isDeleting={isDeleting}
      onDelete={async ({ deleteAssociatedPromptOrDecision }) => {
        await deleteProjectEvaluators({
          projectEvaluatorIds: projectEvaluators.map(({ id }) => id),
          deleteAssociatedPromptOrDecision,
        });
        if (projectId) {
          await refetchProjectEvaluators({
            environment,
            projectId,
            timeRange: timeRangeISOStrings,
          });
        }
      }}
    />
  );
}
