import React, { ReactNode, useCallback, useState } from "react";

import {
  ActionMenu,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Item,
  Text,
} from "@arizeai/components";

import { DeleteUserDialog } from "./DeleteUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

type UserActionMenuProps = {
  userId: string;
  onUserDeleted: () => void;
};

enum UserAction {
  DELETE = "deleteUser",
  RESET_PASSWORD = "resetPassword",
}

export function UserActionMenu(props: UserActionMenuProps) {
  const { userId, onUserDeleted } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);

  const onDelete = useCallback(() => {
    setDialog(
      <DeleteUserDialog
        userId={userId}
        onClose={() => setDialog(null)}
        onDeleted={() => {
          onUserDeleted();
          setDialog(null);
        }}
      />
    );
  }, [userId, onUserDeleted]);

  const onPasswordReset = useCallback(() => {
    setDialog(
      <ResetPasswordDialog userId={userId} onClose={() => setDialog(null)} />
    );
  }, [userId]);
  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        align="end"
        buttonSize="compact"
        onAction={(action) => {
          switch (action) {
            case UserAction.DELETE:
              onDelete();
              break;
            case UserAction.RESET_PASSWORD:
              onPasswordReset();
              break;
          }
        }}
      >
        <Item key={UserAction.DELETE}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.TrashOutline />} />
            <Text>Delete</Text>
          </Flex>
        </Item>
        <Item key={UserAction.RESET_PASSWORD}>
          <Flex
            direction={"row"}
            gap="size-75"
            justifyContent={"start"}
            alignItems={"center"}
          >
            <Icon svg={<Icons.Edit2Outline />} />
            <Text>Reset Password</Text>
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
    </div>
  );
}
