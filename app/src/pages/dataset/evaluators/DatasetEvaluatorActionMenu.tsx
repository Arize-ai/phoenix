import { useState } from "react";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import { EditDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditDatasetEvaluatorSlideover";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { UnassignDatasetEvaluatorDialog } from "@phoenix/pages/dataset/evaluators/UnassignDatasetEvaluatorDialog";

enum DatasetEvaluatorAction {
  UNASSIGN = "unassign",
  EDIT = "edit",
}

export function DatasetEvaluatorActionMenu({
  evaluatorId,
  evaluatorName,
  datasetId,
  evaluatorKind,
}: {
  evaluatorId: string;
  evaluatorName: string;
  datasetId: string;
  evaluatorKind: "LLM" | "CODE";
}) {
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
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
                case DatasetEvaluatorAction.UNASSIGN:
                  setIsUnassignDialogOpen(true);
                  break;
                case DatasetEvaluatorAction.EDIT:
                  setIsEditDialogOpen(true);
                  break;
              }
            }}
          >
            {evaluatorKind === "LLM" && (
              <MenuItem id={DatasetEvaluatorAction.EDIT}>Edit</MenuItem>
            )}
            <MenuItem id={DatasetEvaluatorAction.UNASSIGN}>Unlink</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <UnassignDatasetEvaluatorDialog
        evaluatorId={evaluatorId}
        evaluatorName={evaluatorName}
        datasetId={datasetId}
        isOpen={isUnassignDialogOpen}
        onOpenChange={setIsUnassignDialogOpen}
      />
      <EditDatasetEvaluatorSlideover
        evaluatorId={evaluatorId}
        displayName={evaluatorName}
        datasetId={datasetId}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </StopPropagation>
  );
}
