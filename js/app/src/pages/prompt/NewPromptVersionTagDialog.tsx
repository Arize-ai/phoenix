import { useState } from "react";
import { graphql, useMutation } from "react-relay";

import { movePromptVersionTag } from "@phoenix/components/prompt/movePromptVersionTag";
import type { VersionTagFormParams } from "@phoenix/components/versions/NewVersionTagDialog";
import { NewVersionTagDialog } from "@phoenix/components/versions/NewVersionTagDialog";

import type { NewPromptVersionTagDialogMutation } from "./__generated__/NewPromptVersionTagDialogMutation.graphql";

export function NewPromptVersionDialog({
  onNewTagCreated,
  promptId,
  promptVersionId,
  onDismiss,
}: {
  /**
   * The prompt the version belongs to
   */
  promptId: string;
  /**
   * The prompt version to set the tag on
   */
  promptVersionId: string;
  onNewTagCreated: (tag: VersionTagFormParams) => void;
  onDismiss: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [commitCreate, isCommitting] =
    useMutation<NewPromptVersionTagDialogMutation>(graphql`
      mutation NewPromptVersionTagDialogMutation(
        $input: SetPromptVersionTagInput!
      ) {
        setPromptVersionTag(input: $input) {
          promptVersionTag {
            id
            name
            promptVersionId
          }
        }
      }
    `);
  const onSubmit = (newTag: VersionTagFormParams) => {
    setError(null);
    commitCreate({
      variables: {
        input: {
          name: newTag.name,
          description: newTag.description,
          promptVersionId: promptVersionId,
        },
      },
      updater: (store, data) => {
        const tagId = data?.setPromptVersionTag.promptVersionTag?.id;
        if (tagId) {
          movePromptVersionTag({
            store,
            promptId,
            versionId: promptVersionId,
            tagId,
          });
        }
      },
      onCompleted: () => {
        onNewTagCreated(newTag);
        onDismiss();
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  return (
    <NewVersionTagDialog
      title="New Prompt Tag"
      onSubmit={onSubmit}
      onDismiss={onDismiss}
      error={error}
      isCommitting={isCommitting}
    />
  );
}
