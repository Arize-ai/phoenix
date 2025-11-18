import { useMemo, useState } from "react";
import { type DataID } from "relay-runtime";

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
  ModalOverlay,
  Popover,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";

import { AuthMethod } from "./__generated__/UsersTable_users.graphql";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";

type UserActionMenuProps = {
  userId: string;
  authMethod: AuthMethod;
  connectionIds: DataID[];
};

enum UserAction {
  DELETE = "deleteUser",
  RESET_PASSWORD = "resetPassword",
}

function isLocalAuth(authMethod: AuthMethod): authMethod is "LOCAL" {
  return authMethod === "LOCAL";
}

export function UserActionMenu(props: UserActionMenuProps) {
  const { userId, authMethod, connectionIds } = props;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

  const actionMenuItems = useMemo(() => {
    const deleteUserItemEl = (
      <MenuItem key={UserAction.DELETE} id={UserAction.DELETE}>
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
    );

    const resetPasswordItemEl = (
      <MenuItem key={UserAction.RESET_PASSWORD} id={UserAction.RESET_PASSWORD}>
        <Flex
          direction={"row"}
          gap="size-75"
          justifyContent={"start"}
          alignItems={"center"}
        >
          <Icon svg={<Icons.Refresh />} />
          <>Reset Password</>
        </Flex>
      </MenuItem>
    );

    const actionMenuItems = [deleteUserItemEl];
    if (isLocalAuth(authMethod)) {
      actionMenuItems.push(resetPasswordItemEl);
    }
    return actionMenuItems;
  }, [authMethod]);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover>
          <Menu
            aria-label="User Actions"
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
          </Menu>
        </Popover>
      </MenuTrigger>
      <DialogTrigger
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <ModalOverlay>
          <Modal>
            <DeleteUserDialog
              userId={userId}
              onClose={() => setShowDeleteDialog(false)}
              connectionIds={connectionIds}
              onDeleted={() => {
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
    </StopPropagation>
  );
}
