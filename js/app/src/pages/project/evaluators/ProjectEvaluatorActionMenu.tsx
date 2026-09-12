import { useState } from "react";
import { useNavigate } from "react-router";

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
import type { EvaluationTarget } from "@phoenix/pages/project/evaluators/__generated__/createProjectLlmEvaluatorMutation.graphql";
import { DeleteProjectEvaluatorDialog } from "@phoenix/pages/project/evaluators/DeleteProjectEvaluatorDialog";

enum ProjectEvaluatorAction {
  EDIT = "edit",
  OPEN_IN_PLAYGROUND = "open-in-playground",
  DELETE = "delete",
}

/** The evaluator playground, over this project, with the evaluator in slot A. */
export function getProjectEvaluatorPlaygroundPath({
  projectId,
  projectEvaluatorId,
  filterCondition,
}: {
  projectId: string;
  projectEvaluatorId: string;
  filterCondition: string;
}) {
  const params = new URLSearchParams({
    mode: "evaluators",
    projectId,
    projectEvaluatorA: projectEvaluatorId,
  });

  if (filterCondition) params.set("filterCondition", filterCondition);

  return `/playground?${params}`;
}

export function ProjectEvaluatorActionMenu({
  projectEvaluatorId,
  projectId,
  evaluatorKind,
  evaluatorName,
  filterCondition,
  evaluationTarget,
  onEdit,
}: {
  projectEvaluatorId: string;
  projectId: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  evaluatorName: string;
  /** Carried into the playground so its rows match what the evaluator runs on. */
  filterCondition: string;
  evaluationTarget: EvaluationTarget;
  /** Passed in by the table, so the edit path is derived once per render and
   * not once per row. */
  onEdit: (projectEvaluatorId: string) => void;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const navigate = useNavigate();
  const canEdit = evaluatorKind === "LLM" || evaluatorKind === "CODE";
  // The playground runs over spans; a trace or session evaluator would be
  // refused there, so the entry is only offered for span evaluators.
  const canOpenInPlayground = canEdit && evaluationTarget === "SPAN";
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
                  onEdit(projectEvaluatorId);
                  break;
                case ProjectEvaluatorAction.OPEN_IN_PLAYGROUND:
                  void navigate(
                    getProjectEvaluatorPlaygroundPath({
                      projectId,
                      projectEvaluatorId,
                      filterCondition,
                    })
                  );
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
            {canOpenInPlayground ? (
              <MenuItem id={ProjectEvaluatorAction.OPEN_IN_PLAYGROUND}>
                <Flex
                  direction="row"
                  gap="size-75"
                  justifyContent="start"
                  alignItems="center"
                >
                  <Icon svg={<Icons.PlayCircle />} />
                  <Text>Open in evaluator playground</Text>
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
      <DeleteProjectEvaluatorDialog
        projectEvaluatorId={projectEvaluatorId}
        projectId={projectId}
        evaluatorName={evaluatorName}
        evaluatorKind={evaluatorKind}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
      />
    </StopPropagation>
  );
}
