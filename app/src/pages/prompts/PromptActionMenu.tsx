import { useCallback, useState } from "react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  Popover,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { DeletePromptDialog } from "./DeletePromptDialog";

enum PromptAction {
  DELETE = "DELETE",
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
            <MenuItem id={PromptAction.DELETE}>
              <Flex
                direction={"row"}
                gap="size-75"
                justifyContent={"start"}
                alignItems={"center"}
              >
                <Icon svg={<Icons.TrashOutline />} />
                <>Delete</>
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
