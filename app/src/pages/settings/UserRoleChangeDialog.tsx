import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { Button, Dialog, Flex, Text, View } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { normalizeUserRole } from "@phoenix/constants";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import {
  UserRoleChangeDialogMutation,
  UserRoleInput,
} from "./__generated__/UserRoleChangeDialogMutation.graphql";

export function UserRoleChangeDialog({
  userId,
  username,
  currentRole,
  newRole,
  onClose,
}: {
  userId: string;
  username: string;
  newRole: UserRoleInput;
  currentRole: string;
  onClose: () => void;
}) {
  const [commit, isCommitting] = useMutation<UserRoleChangeDialogMutation>(
    graphql`
      mutation UserRoleChangeDialogMutation($input: PatchUserInput!) {
        patchUser(input: $input) {
          user {
            id
            role {
              id
              name
            }
          }
        }
      }
    `
  );

  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const handleChange = useCallback(() => {
    commit({
      variables: {
        input: {
          userId: userId,
          newRole,
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Role Changed",
          message: "Users role has been changed.",
        });
        onClose();
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete user",
          message: error.message,
        });
      },
    });
  }, [commit, newRole, notifyError, notifySuccess, onClose, userId]);
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm role change</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton onPress={onClose} slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
        <View padding="size-200">
          <Text>
            {`Are you sure you want to change the role for ${username} from `}{" "}
            <b>{normalizeUserRole(currentRole)}</b> to{" "}
            <b>{normalizeUserRole(newRole)}</b>?
          </Text>
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end" gap={"size-100"}>
            <Button onPress={onClose} size="S">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="S"
              onPress={() => {
                handleChange();
              }}
              isDisabled={isCommitting}
            >
              Change role
            </Button>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
