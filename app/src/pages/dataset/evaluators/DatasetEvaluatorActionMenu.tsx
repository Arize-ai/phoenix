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
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { UnassignDatasetEvaluatorDialog } from "@phoenix/pages/dataset/evaluators/UnassignDatasetEvaluatorDialog";

enum DatasetEvaluatorAction {
  UNASSIGN = "unassign",
}

export function DatasetEvaluatorActionMenu({
  evaluatorId,
  evaluatorName,
  datasetId,
}: {
  evaluatorId: string;
  evaluatorName: string;
  datasetId: string;
}) {
  const [isUnassignDialogOpen, setIsUnassignDialogOpen] = useState(false);
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
              }
            }}
          >
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
    </StopPropagation>
  );
}
