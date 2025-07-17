import { useCallback } from "react";
import { graphql, useMutation } from "react-relay";

import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

import { DeletePromptDialogMutation } from "./__generated__/DeletePromptDialogMutation.graphql";

export function DeletePromptDialog({
  promptId,
  onDeleted,
}: {
  promptId: string;
  onDeleted: () => void;
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
      },
      onError: (error) => {
        notifyError({
          title: "Failed to delete prompt",
          message: error.message,
        });
      },
    });
  }, [commit, notifyError, notifySuccess, onDeleted, promptId]);

  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Prompt</DialogTitle>
          <DialogTitleExtra>
            <DialogCloseButton slot="close" />
          </DialogTitleExtra>
        </DialogHeader>
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
            <Button variant="default" slot="close" size="S">
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
      </DialogContent>
    </Dialog>
  );
}
