import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { DeleteVersionTagButton } from "@phoenix/components/versions/DeleteVersionTagButton";
import { useNotifySuccess } from "@phoenix/contexts";
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
  const [error, setError] = useState<string | null>(null);
  const notifySuccess = useNotifySuccess();
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
      onOpenChange={(open) => {
        setIsOpen(open);
        setError(null);
      }}
      isDeleting={isCommitting}
      error={error}
      warning="Are you sure you want to delete this tag? This will make pulling decisions by this tag no longer possible. Make sure this tag is not used before deleting."
      onDelete={() => {
        setError(null);
        commitDelete({
          variables: { id: tagId },
          onCompleted: (_, errors) => {
            if (errors?.length) {
              setError(errors.map((error) => error.message).join("\n"));
              return;
            }
            setIsOpen(false);
            notifySuccess({
              title: "Tag Deleted",
              message: "The tag has been deleted",
            });
            onDeleted();
          },
          onError: (error) =>
            setError(
              getErrorMessagesFromRelayMutationError(error)?.[0] ??
                error.message
            ),
        });
      }}
    />
  );
}
