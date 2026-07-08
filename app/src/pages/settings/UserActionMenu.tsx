import { Suspense, useMemo, useState } from "react";
import type { DataID } from "relay-runtime";

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
  ModalOverlay,
  Popover,
} from "@phoenix/components";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useFunctionality } from "@phoenix/contexts/FunctionalityContext";

import type { AuthMethod } from "./__generated__/UsersTable_users.graphql";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { ResetPasswordDialog } from "./ResetPasswordDialog";
import { UserAccessDialog } from "./UserAccessDialog";

type UserActionMenuProps = {
  userId: string;
  userLabel: string;
  authMethod: AuthMethod;
  connectionIds: DataID[];
};

enum UserAction {
  VIEW_ACCESS = "viewAccess",
  DELETE = "deleteUser",
  RESET_PASSWORD = "resetPassword",
}

function isLocalAuth(authMethod: AuthMethod): authMethod is "LOCAL" {
  return authMethod === "LOCAL";
}

export function UserActionMenu(props: UserActionMenuProps) {
  const { userId, userLabel, authMethod, connectionIds } = props;
  const { accessControlEnabled } = useFunctionality();
  const [showAccessDialog, setShowAccessDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

  const actionMenuItems = useMemo(() => {
    const viewAccessItemEl = (
      <MenuItem key={UserAction.VIEW_ACCESS} id={UserAction.VIEW_ACCESS}>
        <Flex
          direction={"row"}
          gap="size-75"
          justifyContent={"start"}
          alignItems={"center"}
        >
          <Icon svg={<Icons.Eye />} />
          <>View access</>
        </Flex>
      </MenuItem>
    );

    const deleteUserItemEl = (
      <MenuItem key={UserAction.DELETE} id={UserAction.DELETE}>
        <Flex
          direction={"row"}
          gap="size-75"
          justifyContent={"start"}
          alignItems={"center"}
        >
          <Icon svg={<Icons.Trash />} />
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

    const actionMenuItems = accessControlEnabled
      ? [viewAccessItemEl, deleteUserItemEl]
      : [deleteUserItemEl];
    if (isLocalAuth(authMethod)) {
      actionMenuItems.push(resetPasswordItemEl);
    }
    return actionMenuItems;
  }, [accessControlEnabled, authMethod]);

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size="S"
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
        />
        <Popover>
          <Menu
            aria-label="User Actions"
            onAction={(action) => {
              switch (action) {
                case UserAction.VIEW_ACCESS:
                  setShowAccessDialog(true);
                  break;
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
        isOpen={showAccessDialog}
        onOpenChange={setShowAccessDialog}
      >
        <ModalOverlay>
          <Modal>
            <Suspense fallback={<Loading />}>
              <UserAccessDialog
                userId={userId}
                userLabel={userLabel}
                onClose={() => setShowAccessDialog(false)}
              />
            </Suspense>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
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
