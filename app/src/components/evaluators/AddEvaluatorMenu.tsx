import { useState } from "react";
import { DialogTrigger, MenuTriggerProps } from "react-aria-components";

import { Button, ButtonProps } from "@phoenix/components/button";
import { CreateDatasetEvaluatorSlideover } from "@phoenix/components/dataset/CreateDatasetEvaluatorSlideover";
import { Icon, Icons } from "@phoenix/components/icon";
import {
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
} from "@phoenix/components/menu";

export const AddEvaluatorMenu = ({
  size,
  datasetId,
  updateConnectionIds,
  ...props
}: {
  size: ButtonProps["size"];
  datasetId: string;
  updateConnectionIds: string[];
} & Omit<MenuTriggerProps, "children">) => {
  const [createEvaluatorDialogOpen, setCreateEvaluatorDialogOpen] =
    useState(false);
  return (
    <>
      <MenuTrigger {...props}>
        <Button
          size={size}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          Add evaluator
        </Button>
        {/* TODO: Remove minHeight once we have more items in the menu */}
        <MenuContainer minHeight={"auto"}>
          <Menu
            onAction={(action) => {
              switch (action) {
                case "createEvaluator":
                  setCreateEvaluatorDialogOpen(true);
                  break;
              }
            }}
          >
            <MenuItem id="createEvaluator">Create new evaluator</MenuItem>
          </Menu>
        </MenuContainer>
      </MenuTrigger>
      <DialogTrigger
        isOpen={createEvaluatorDialogOpen}
        onOpenChange={setCreateEvaluatorDialogOpen}
      >
        <CreateDatasetEvaluatorSlideover
          datasetId={datasetId}
          updateConnectionIds={updateConnectionIds}
        />
      </DialogTrigger>
    </>
  );
};
