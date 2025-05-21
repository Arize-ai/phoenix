import { ReactNode, useCallback, useMemo, useState } from "react";

import { ActionMenu, DialogContainer, Item } from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";

import { AuthMethod } from "./__generated__/UsersTable_users.graphql";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

type UserActionMenuProps = {
  userId: string;
  onUserDeleted: () => void;
  authMethod: AuthMethod;
};

enum UserAction {
  DELETE = "deleteUser",
  RESET_PASSWORD = "resetPassword",
}

function isLocalAuth(authMethod: AuthMethod): authMethod is "LOCAL" {
  return authMethod === "LOCAL";
}

export function UserActionMenu(props: UserActionMenuProps) {
  const { userId, onUserDeleted, authMethod } = props;
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

  const actionMenuItems = useMemo(() => {
    const deleteUserItemEl = (
      <Item key={UserAction.DELETE}>
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
    );

    const resetPasswordItemEl = (
      <Item key={UserAction.RESET_PASSWORD}>
        <Flex
          direction={"row"}
          gap="size-75"
          justifyContent={"start"}
          alignItems={"center"}
        >
          <Icon svg={<Icons.Refresh />} />
          <>Reset Password</>
        </Flex>
      </Item>
    );

    const actionMenuItems = [deleteUserItemEl];
    if (isLocalAuth(authMethod)) {
      actionMenuItems.push(resetPasswordItemEl);
    }
    return actionMenuItems;
  }, [authMethod]);

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
        aria-label="User Actions"
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
        {actionMenuItems}
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
