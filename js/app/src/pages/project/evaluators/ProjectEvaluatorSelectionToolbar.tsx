import { useState } from "react";

import { EvaluatorSelectionToolbar } from "@phoenix/components/evaluators/EvaluatorSelectionToolbar";
import { CompareProjectEvaluatorsButton } from "@phoenix/pages/project/evaluators/CompareProjectEvaluatorsButton";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";
import { getSelectedProjectEvaluators } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";
import type { ProjectEvaluatorSelection } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

export function ProjectEvaluatorSelectionToolbar({
  projectId,
  selection,
  evaluatorsById,
  onClearSelection,
}: {
  projectId: string;
  /** Every selected evaluator, including rows a search hides, for Compare. */
  selection: ProjectEvaluatorSelection;
  /** The rows the table has loaded, which limit the count and Delete. */
  evaluatorsById: ProjectEvaluatorSelection;
  onClearSelection: () => void;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const selectedEvaluators = getSelectedProjectEvaluators({
    selection,
    evaluatorsById,
  });
  return (
    <>
      <EvaluatorSelectionToolbar
        selectedCount={selectedEvaluators.length}
        onClearSelection={onClearSelection}
        onDelete={() => setIsDeleteOpen(true)}
      >
        <CompareProjectEvaluatorsButton selection={selection} />
      </EvaluatorSelectionToolbar>
      <DeleteProjectEvaluatorDialog
        projectEvaluators={selectedEvaluators}
        projectId={projectId}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onDeleted={onClearSelection}
      />
    </>
  );
}
