import { css } from "@emotion/react";
import { Suspense, useCallback, useState } from "react";
import { SubmenuTrigger } from "react-aria-components";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Loading,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  Popover,
  PopoverArrow,
  Text,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { DecisionLabelSelectionContent } from "@phoenix/pages/decisions/DecisionLabelConfigButton";

import { DeleteDecisionDialog } from "./DeleteDecisionDialog";

enum DecisionAction {
  DELETE = "DELETE",
  LABELS = "LABELS",
}

export function DecisionActionMenu({
  onDeleted,
  decisionId,
}: {
  decisionId: string;
  onDeleted: () => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const onDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          aria-label="Decision actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover>
          <Menu
            aria-label="Decision action menu"
            onAction={(action) => {
              switch (action) {
                case DecisionAction.DELETE:
                  onDelete();
                  break;
              }
            }}
          >
            <SubmenuTrigger>
              <MenuItem id={DecisionAction.LABELS}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.PriceTags />} />
                  <Text>Label</Text>
                </Flex>
              </MenuItem>
              <Popover
                placement="start top"
                css={css`
                  min-width: 300px;
                  width: 300px;
                `}
              >
                <PopoverArrow />
                <Suspense
                  fallback={
                    <Loading
                      css={css`
                        min-width: 300px;
                        min-height: 100px;
                      `}
                    />
                  }
                >
                  <DecisionLabelSelectionContent decisionId={decisionId} />
                </Suspense>
              </Popover>
            </SubmenuTrigger>
            <MenuItem id={DecisionAction.DELETE}>
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.Trash />} />
                <Text>Delete</Text>
              </Flex>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <Modal>
          <DeleteDecisionDialog
            decisionId={decisionId}
            onDeleted={() => {
              onDeleted();
              setShowDeleteDialog(false);
            }}
          />
        </Modal>
      </DialogTrigger>
    </StopPropagation>
  );
}
