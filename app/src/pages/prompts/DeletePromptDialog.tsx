import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import { Dialog } from "@arizeai/components";

import { Button, Flex, Text, View } from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DeletePromptDialogMutation } from "./__generated__/DeletePromptDialogMutation.graphql";

export function DeletePromptDialog({
  promptId,
  onDeleted,
  onClose,
}: {
  promptId: string;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [commit, isCommitting] = useMutation<DeletePromptDialogMutation>(
    graphql`
      mutation DeletePromptDialogMutation($promptId: ID!) {
        deletePrompt(input: { promptId: $promptId }) {
          query {
            ...PromptsTable_prompts
          }
        }
      }
    `
  );

  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();

  const handleDelete = useCallback(() => {
    commit({
      variables: {
        promptId,
      },
      onCompleted: () => {
        notifySuccess({
          title: "Delete Successful",
          message: "Prompt has been deleted.",
        });
        onDeleted();
        onClose();
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete prompt",
          message: error.message,
        });
      },
    });
  }, [commit, notifyError, notifySuccess, onClose, onDeleted, promptId]);
  return (
    <Dialog title="Delete Prompt" isDismissable onDismiss={onClose}>
      <View padding="size-200">
        <Text color="danger">
          {`Are you sure you want to delete this prompt? This action cannot be undone and all services dependent on this prompt will be affected.`}
        </Text>
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end" gap="size-100">
          <Button variant="default" onPress={onClose} size="S">
            Cancel
          </Button>
          <Button
            variant="danger"
            onPress={() => {
              handleDelete();
            }}
            size="S"
            isDisabled={isCommitting}
          >
            Delete Prompt
          </Button>
        </Flex>
      </View>
    </Dialog>
  );
}
