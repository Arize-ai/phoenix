import { graphql, useMutation } from "react-relay";

import { EditDetailsButton } from "@phoenix/components/versions/EditDetailsButton";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditDecisionButtonPatchMutation } from "./__generated__/EditDecisionButtonPatchMutation.graphql";

export function EditDecisionButton({
  decisionId,
  description,
  metadata,
  onSaved,
}: {
  decisionId: string;
  description: string | null;
  metadata: unknown;
  onSaved: () => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [commit, isPending] = useMutation<EditDecisionButtonPatchMutation>(
    graphql`
      mutation EditDecisionButtonPatchMutation(
        $id: ID!
        $description: String
        $metadata: JSON!
      ) {
        patchDecision(
          input: {
            decisionId: $id
            description: $description
            metadata: $metadata
          }
        ) {
          id
          description
          metadata
        }
      }
    `
  );
  const onSubmit = ({
    description,
    metadata,
  }: {
    description: string;
    metadata: unknown;
  }) =>
    new Promise<string | null>((resolve) => {
      commit({
        variables: {
          id: decisionId,
          description: description || null,
          metadata: metadata ?? {},
        },
        onCompleted: (_, errors) => {
          if (errors?.length) {
            resolve(errors.map((error) => error.message).join("\n"));
            return;
          }
          notifySuccess({
            title: "Decision updated",
            message: "The decision has been updated successfully",
          });
          onSaved();
          resolve(null);
        },
        onError: (error) =>
          resolve(
            getErrorMessagesFromRelayMutationError(error)?.[0] ??
              "Error updating decision"
          ),
      });
    });
  return (
    <EditDetailsButton
      entityLabel="Decision"
      description={description}
      metadata={metadata}
      onSubmit={onSubmit}
      isSubmitting={isPending}
    />
  );
}
