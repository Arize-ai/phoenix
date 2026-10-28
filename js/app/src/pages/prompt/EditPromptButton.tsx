import { useCallback } from "react";
import { graphql, useFragment, useMutation } from "react-relay";

import { EditDetailsButton } from "@phoenix/components/versions/EditDetailsButton";
import { useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

import type { EditPromptButton_data$key } from "./__generated__/EditPromptButton_data.graphql";
import type { EditPromptButtonPatchPromptMutation } from "./__generated__/EditPromptButtonPatchPromptMutation.graphql";

export function EditPromptButton(props: { prompt: EditPromptButton_data$key }) {
  const notifySuccess = useNotifySuccess();
  const data = useFragment(
    graphql`
      fragment EditPromptButton_data on Prompt {
        id
        description
        metadata
      }
    `,
    props.prompt
  );
  const [mutatePrompt, isMutating] =
    useMutation<EditPromptButtonPatchPromptMutation>(graphql`
      mutation EditPromptButtonPatchPromptMutation($input: PatchPromptInput!) {
        patchPrompt(input: $input) {
          ...PromptIndexPage__main
        }
      }
    `);
  const onSubmit = useCallback(
    ({ description, metadata }: { description: string; metadata: unknown }) =>
      new Promise<string | null>((resolve) => {
        mutatePrompt({
          variables: {
            input: {
              promptId: data.id,
              description,
              metadata,
            },
          },
          onCompleted: () => {
            notifySuccess({
              title: "Prompt updated",
              message: "The prompt has been updated successfully",
            });
            resolve(null);
          },
          onError: (error) => {
            resolve(
              getErrorMessagesFromRelayMutationError(error)?.[0] ??
                "Error updating prompt"
            );
          },
        });
      }),
    [data.id, mutatePrompt, notifySuccess]
  );
  return (
    <EditDetailsButton
      entityLabel="Prompt"
      description={data.description}
      metadata={data.metadata}
      onSubmit={onSubmit}
      isSubmitting={isMutating}
    />
  );
}
