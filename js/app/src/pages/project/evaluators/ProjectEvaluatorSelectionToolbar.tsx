import { useState } from "react";

import { EvaluatorSelectionToolbar } from "@phoenix/components/evaluators/EvaluatorSelectionToolbar";
import { CompareProjectEvaluatorsButton } from "@phoenix/pages/project/evaluators/CompareProjectEvaluatorsButton";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";
import { getSelectedProjectEvaluators } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";
import type { ProjectEvaluatorSelection } from "@phoenix/pages/project/evaluators/projectEvaluatorSelection";

export function ProjectEvaluatorSelectionToolbar({
  projectId,
  selection,
  onClearSelection,
}: {
  projectId: string;
  selection: ProjectEvaluatorSelection;
  onClearSelection: () => void;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const selectedEvaluators = getSelectedProjectEvaluators(selection);
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
