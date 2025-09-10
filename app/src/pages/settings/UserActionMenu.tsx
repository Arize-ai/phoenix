import { useMemo, useState } from "react";

import { ActionMenu, Item } from "@arizeai/components";

import {
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
} from "@phoenix/components";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

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
              setShowDeleteDialog(true);
              break;
            case UserAction.RESET_PASSWORD:
              setShowResetPasswordDialog(true);
              break;
          }
        }}
      >
        {actionMenuItems}
      </ActionMenu>
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <ModalOverlay>
          <Modal>
            <DeleteUserDialog
              userId={userId}
              onClose={() => setShowDeleteDialog(false)}
              onDeleted={() => {
                onUserDeleted();
                setShowDeleteDialog(false);
              }}
            />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <DialogTrigger
        isOpen={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
      >
        <ModalOverlay>
          <Modal>
            <ResetPasswordDialog
              userId={userId}
              onClose={() => setShowResetPasswordDialog(false)}
            />
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </div>
  );
}
