import { ReactNode, useCallback, useState } from "react";

import { ActionMenu, DialogContainer, Item } from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";
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
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onDelete = useCallback(() => {
    setDialog(
      <DeletePromptDialog
        promptId={promptId}
        onClose={() => setDialog(null)}
        onDeleted={() => {
          onDeleted();
          setDialog(null);
        }}
      />
    );
  }, [promptId, onDeleted]);

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
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => setDialog(null)}
      >
        {dialog}
      </DialogContainer>
    </StopPropagation>
  );
}
