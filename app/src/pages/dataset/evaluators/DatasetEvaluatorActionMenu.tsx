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
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { DeleteDatasetEvaluatorDialog } from "./DeleteDatasetEvaluatorDialog";

enum DatasetEvaluatorAction {
  EDIT = "edit",
  DELETE = "delete",
}

export function DatasetEvaluatorActionMenu({
  datasetId,
  datasetEvaluatorId,
  evaluatorKind,
  evaluatorName,
  updateConnectionIds,
}: {
  datasetId: string;
  datasetEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE" | "BUILTIN";
  evaluatorName: string;
  updateConnectionIds?: string[];
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          variant="quiet"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover placement="bottom right">
          <Menu
            onAction={(action) => {
              switch (action) {
                case DatasetEvaluatorAction.EDIT:
                  setIsEditDialogOpen(true);
                  break;
                case DatasetEvaluatorAction.DELETE:
                  setIsDeleteDialogOpen(true);
                  break;
              }
            }}
          >
            <MenuItem id={DatasetEvaluatorAction.EDIT}>
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.Edit2Outline />} />
                <Text>Edit</Text>
              </Flex>
            </MenuItem>
            <MenuItem id={DatasetEvaluatorAction.DELETE}>
              <Flex
                direction="row"
                gap="size-75"
                justifyContent="start"
                alignItems="center"
              >
                <Icon svg={<Icons.TrashOutline />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {evaluatorKind === "BUILTIN" ? (
        <EditBuiltInDatasetEvaluatorSlideover
          datasetEvaluatorId={datasetEvaluatorId}
          datasetId={datasetId}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          updateConnectionIds={updateConnectionIds}
        />
      ) : (
        <EditLLMDatasetEvaluatorSlideover
          datasetEvaluatorId={datasetEvaluatorId}
          datasetId={datasetId}
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          updateConnectionIds={updateConnectionIds}
        />
      )}
      <DeleteDatasetEvaluatorDialog
        datasetEvaluatorId={datasetEvaluatorId}
        evaluatorName={evaluatorName}
        evaluatorKind={evaluatorKind}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        updateConnectionIds={updateConnectionIds}
      />
    </StopPropagation>
  );
}
