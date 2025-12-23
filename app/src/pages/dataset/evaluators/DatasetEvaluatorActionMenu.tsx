import { useState } from "react";
import { useNavigate } from "react-router";

import {
  Button,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from "@phoenix/components";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { UnassignDatasetEvaluatorDialog } from "@phoenix/pages/dataset/evaluators/UnassignDatasetEvaluatorDialog";

enum DatasetEvaluatorAction {
  VIEW_DETAILS = "viewDetails",
  UNASSIGN = "unassign",
  EDIT = "edit",
}

export function DatasetEvaluatorActionMenu({
  datasetId,
  evaluatorDisplayName,
  datasetEvaluatorId,
  evaluatorKind,
  isBuiltIn,
  updateConnectionIds,
}: {
  datasetId: string;
  evaluatorDisplayName: string;
  datasetEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE";
  isBuiltIn: boolean;
  updateConnectionIds?: string[];
}) {
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const navigate = useNavigate();
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
                case DatasetEvaluatorAction.VIEW_DETAILS:
                  navigate(
                    `/datasets/${datasetId}/evaluators/${datasetEvaluatorId}`
                  );
                  break;
                case DatasetEvaluatorAction.UNASSIGN:
                  setIsUnassignDialogOpen(true);
                  break;
                case DatasetEvaluatorAction.EDIT:
                  setIsEditDialogOpen(true);
                  break;
              }
            }}
          >
            <MenuItem id={DatasetEvaluatorAction.VIEW_DETAILS}>
              View details
            </MenuItem>
            {(evaluatorKind === "LLM" || isBuiltIn) && (
              <MenuItem id={DatasetEvaluatorAction.EDIT}>Edit</MenuItem>
            )}
            <MenuItem id={DatasetEvaluatorAction.UNASSIGN}>Unlink</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <UnassignDatasetEvaluatorDialog
        evaluatorName={evaluatorDisplayName}
        datasetEvaluatorId={datasetEvaluatorId}
        datasetId={datasetId}
        isOpen={isUnassignDialogOpen}
        onOpenChange={setIsUnassignDialogOpen}
        updateConnectionIds={updateConnectionIds}
      />
      {isBuiltIn ? (
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
    </StopPropagation>
  );
}
