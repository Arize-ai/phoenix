import { useState } from "react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";
import { EditProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/EditProjectEvaluatorSlideover";

enum ProjectEvaluatorAction {
  EDIT = "edit",
  DELETE = "delete",
}

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
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          variant="quiet"
          aria-label="Evaluator actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover placement="bottom right">
          <Menu
            onAction={(action) => {
              switch (action) {
                case ProjectEvaluatorAction.EDIT:
                  setIsEditOpen(true);
                  break;
                case ProjectEvaluatorAction.DELETE:
                  setIsDeleteOpen(true);
                  break;
              }
            }}
          >
            {canEdit ? (
              <MenuItem id={ProjectEvaluatorAction.EDIT}>
                <Flex
                  direction="row"
                  gap="size-75"
                  justifyContent="start"
                  alignItems="center"
                >
                  <Icon svg={<Icons.Edit2 />} />
                  <Text>Edit</Text>
                </Flex>
              </MenuItem>
            ) : null}
            <MenuItem id={ProjectEvaluatorAction.DELETE}>
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.Trash />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
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
    </StopPropagation>
  );
}
