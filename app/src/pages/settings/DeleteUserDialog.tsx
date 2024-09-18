import React, { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { Button, Dialog, Flex, Text, View } from "@arizeai/components";

import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

export function DeleteUserDialog({
  userId,
  onDeleted,
  onClose,
}: {
  userId: string;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [commit, isCommitting] = useMutation(graphql`
    mutation DeleteUserDialogMutation($input: DeleteUsersInput!) {
      deleteUsers(input: $input)
    }
  `);

  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const handleDelete = useCallback(() => {
    commit({
      variables: {
        input: {
          userIds: [userId],
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "User deleted",
          message: "User has been deleted.",
        });
        onDeleted();
        onClose();
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete user",
          message: error.message,
        });
      },
    });
  }, [commit, notifyError, notifySuccess, onClose, onDeleted, userId]);
  return (
    <Dialog title="Delete User" isDismissable onDismiss={onClose}>
      <View padding="size-200">
        <Text color="danger">
          {`Are you sure you want to delete this user? This action cannot be undone.`}
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
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              handleDelete();
            }}
            disabled={isCommitting}
          >
            Delete user
          </Button>
        </Flex>
      </View>
    </Dialog>
  );
}
