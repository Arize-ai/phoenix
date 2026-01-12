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
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { EditLLMDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditLLMDatasetEvaluatorSlideover";
import { StopPropagation } from "@phoenix/components/StopPropagation";

enum DatasetEvaluatorAction {
  EDIT = "edit",
}

export function DatasetEvaluatorActionMenu({
  datasetId,
  datasetEvaluatorId,
  evaluatorKind,
  isBuiltIn,
  updateConnectionIds,
}: {
  datasetId: string;
  datasetEvaluatorId: string;
  evaluatorKind: "LLM" | "CODE";
  isBuiltIn: boolean;
  updateConnectionIds?: string[];
}) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover placement="bottom right">
          <Menu
            onAction={(action) => {
              switch (action) {
                case DatasetEvaluatorAction.EDIT:
                  setIsEditDialogOpen(true);
                  break;
              }
            }}
          >
            {(evaluatorKind === "LLM" || isBuiltIn) && (
              <MenuItem id={DatasetEvaluatorAction.EDIT}>Edit</MenuItem>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
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
