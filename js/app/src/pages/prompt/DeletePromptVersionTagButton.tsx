import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { DeleteVersionTagButton } from "@phoenix/components/versions/DeleteVersionTagButton";
import {
  useNotifyError,
  useNotifySuccess,
} from "@phoenix/contexts/NotificationContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeletePromptVersionTagButtonMutation } from "./__generated__/DeletePromptVersionTagButtonMutation.graphql";

export function DeletePromptVersionTagButton({
  promptVersionTagId,
  promptId,
}: {
  promptVersionTagId: string;
  promptId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [commitDelete, isCommitting] =
    useMutation<DeletePromptVersionTagButtonMutation>(graphql`
      mutation DeletePromptVersionTagButtonMutation(
        $input: DeletePromptVersionTagInput!
        $promptId: ID!
      ) {
        deletePromptVersionTag(input: $input) {
          query {
            node(id: $promptId) {
              ...PromptVersionTagsConfigCard_data
            }
          }
        }
      }
    `);
  return (
    <DeleteVersionTagButton
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isDeleting={isCommitting}
      warning="Are you sure you want to delete this tag? This will make pulling prompts by this tag no longer possible. Make sure this tag is not used before deleting."
      onDelete={() =>
        commitDelete({
          variables: {
            input: {
              promptVersionTagId,
            },
            promptId,
          },
          onCompleted: () => {
            notifySuccess({
              title: "Tag Deleted",
              message: "The tag has been deleted",
            });
          },
          onError: (error) => {
            setIsOpen(false);
            notifyError({
              title: "Failed to delete tag",
              message:
                getErrorMessagesFromRelayMutationError(error)?.[0] ??
                error.message,
            });
          },
        })
      }
    />
  );
}
