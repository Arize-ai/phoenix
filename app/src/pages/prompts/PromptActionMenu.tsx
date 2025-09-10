import { useCallback, useState } from "react";

import { ActionMenu, Item } from "@arizeai/components";

import { DialogTrigger, Flex, Icon, Icons, Modal } from "@phoenix/components";
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
      <ActionMenu
        align="end"
        aria-label="User Actions"
        buttonSize="compact"
        onAction={(action) => {
          switch (action) {
            case PromptAction.DELETE:
              onDelete();
              break;
          }
        }}
      >
        <Item key={PromptAction.DELETE}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.TrashOutline />} />
            <>Delete</>
          </Flex>
        </Item>
      </ActionMenu>
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
