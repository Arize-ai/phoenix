import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

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
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "Failed to delete user",
          message: formattedError?.[0] ?? error.message,
        });
      },
    });
  }, [commit, notifyError, notifySuccess, onClose, onDeleted, userId]);

  return (
    <Dialog
      css={css`
        width: 500px;
        max-width: 90vw;
      `}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogTitleExtra>
            <Button
              size="S"
              data-testid="dialog-close-button"
              leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
              onPress={onClose}
              type="button"
              variant="default"
            />
          </DialogTitleExtra>
        </DialogHeader>
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
            <Button variant="default" onPress={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                handleDelete();
              }}
              isDisabled={isCommitting}
            >
              Delete user
            </Button>
          </Flex>
        </View>
      </DialogContent>
    </Dialog>
  );
}
