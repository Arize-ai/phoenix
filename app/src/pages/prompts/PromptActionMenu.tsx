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
import { PromptLabelSelectionContent } from "@phoenix/pages/prompt/PromptLabelConfigButton";

import { DeletePromptDialog } from "./DeletePromptDialog";

enum PromptAction {
  DELETE = "DELETE",
  LABELS = "LABELS",
}

export function PromptActionMenu({
  onDeleted,
  promptId,
}: {
  promptId: string;
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
          aria-label="Prompt actions"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover>
          <Menu
            aria-label="Prompt action menu"
            onAction={(action) => {
              switch (action) {
                case PromptAction.DELETE:
                  onDelete();
                  break;
              }
            }}
          >
            <SubmenuTrigger>
              <MenuItem id={PromptAction.LABELS}>
                <Flex
                  direction={"row"}
                  gap="size-75"
                  justifyContent={"start"}
                  alignItems={"center"}
                >
                  <Icon svg={<Icons.PriceTagsOutline />} />
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
                  <PromptLabelSelectionContent promptId={promptId} />
                </Suspense>
              </Popover>
            </SubmenuTrigger>
            <MenuItem id={PromptAction.DELETE}>
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.TrashOutline />} />
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
          <DeletePromptDialog
            promptId={promptId}
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
