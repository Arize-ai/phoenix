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
    <Dialog
      css={css`
        width: 500px;
        max-width: 90vw;
      `}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Prompt</DialogTitle>
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
      </DialogContent>
    </Dialog>
  );
}
