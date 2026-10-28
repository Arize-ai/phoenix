import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { DeleteVersionTagButton } from "@phoenix/components/versions/DeleteVersionTagButton";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { DeleteDecisionVersionTagButtonMutation } from "./__generated__/DeleteDecisionVersionTagButtonMutation.graphql";

export function DeleteDecisionVersionTagButton({
  tagId,
  onDeleted,
}: {
  tagId: string;
  onDeleted: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [commitDelete, isCommitting] =
    useMutation<DeleteDecisionVersionTagButtonMutation>(graphql`
      mutation DeleteDecisionVersionTagButtonMutation($id: ID!) {
        deleteDecisionVersionTag(input: { decisionVersionTagId: $id }) {
          query {
            __typename
          }
        }
      }
    `);
  return (
    <DeleteVersionTagButton
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isDeleting={isCommitting}
      warning="Are you sure you want to delete this tag? This will make pulling decisions by this tag no longer possible. Make sure this tag is not used before deleting."
      onDelete={() =>
        commitDelete({
          variables: { id: tagId },
          onCompleted: (_, errors) => {
            setIsOpen(false);
            if (errors?.length) {
              notifyError({
                title: "Failed to delete tag",
                message: errors.map((error) => error.message).join("\n"),
              });
              return;
            }
            notifySuccess({
              title: "Tag Deleted",
              message: "The tag has been deleted",
            });
            onDeleted();
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
