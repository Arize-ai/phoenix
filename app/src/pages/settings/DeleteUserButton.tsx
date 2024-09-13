import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DeleteUserButtonMutation } from "./__generated__/DeleteUserButtonMutation.graphql";

export function DeleteUserButton({
  userId,
  onDeleted,
}: {
  userId: string;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<ReactNode>(null);

  const [commit, isCommitting] = useMutation<DeleteUserButtonMutation>(graphql`
    mutation DeleteUserButtonMutation($input: DeleteUsersInput!) {
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
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete user",
          message: error.message,
        });
      },
    });
  }, [commit, notifyError, notifySuccess, onDeleted, userId]);

  const onDelete = () => {
    setDialog(
      <Dialog title="Delete User">
        <View padding="size-200">
          <Text color="danger">
            {`Are you sure you want to delete this user? This action cannot be undone. The user will be permanently blocked, and cannot be reactivated with the same email or username.`}
          </Text>
        </View>
        <View
          paddingEnd="size-200"
          paddingTop="size-100"
          paddingBottom="size-100"
          borderTopColor="light"
          borderTopWidth="thin"
        >
          <Flex direction="row" justifyContent="end">
            <Button
              variant="danger"
              onClick={() => {
                handleDelete();
                setDialog(null);
              }}
            >
              Delete user
            </Button>
          </Flex>
        </View>
      </Dialog>
    );
  };
  return (
    <>
      <Button
        variant="danger"
        size="compact"
        icon={<Icon svg={<Icons.TrashOutline />} />}
        aria-label="Delete User"
        onClick={() => {
          onDelete();
        }}
        disabled={isCommitting}
      />
      <DialogContainer
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </>
  );
}
