import { useState } from "react";

import { Button, Flex, Icon, Icons } from "@phoenix/components";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";
import { EditProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/EditProjectEvaluatorSlideover";

export function ProjectEvaluatorActionMenu({
  projectEvaluatorId,
  evaluatorKind,
  evaluatorName,
  updateConnectionIds,
}: {
  projectEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  evaluatorName: string;
  updateConnectionIds: string[];
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const canEdit = evaluatorKind === "LLM" || evaluatorKind === "CODE";
  return (
    <>
      <Flex direction="row" gap="size-50">
        {canEdit ? (
          <Button
            size="S"
            variant="quiet"
            aria-label={`Edit ${evaluatorName}`}
            onPress={() => setIsEditOpen(true)}
            leadingVisual={<Icon svg={<Icons.Edit2 />} />}
          />
        ) : null}
        <Button
          size="S"
          variant="quiet"
          aria-label={`Delete ${evaluatorName}`}
          onPress={() => setIsDeleteOpen(true)}
          leadingVisual={<Icon svg={<Icons.Trash />} />}
        />
      </Flex>
      {canEdit ? (
        <EditProjectEvaluatorSlideover
          projectEvaluatorId={projectEvaluatorId}
          evaluatorKind={evaluatorKind}
          isOpen={isEditOpen}
          onOpenChange={setIsEditOpen}
        />
      ) : null}
      <DeleteProjectEvaluatorDialog
        projectEvaluatorId={projectEvaluatorId}
        evaluatorName={evaluatorName}
        evaluatorKind={evaluatorKind}
        updateConnectionIds={updateConnectionIds}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </>
  );
}
