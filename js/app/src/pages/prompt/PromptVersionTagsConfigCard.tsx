import { useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import type { PromptVersionTagsConfigCard_data$key } from "./__generated__/PromptVersionTagsConfigCard_data.graphql";
import { DeletePromptVersionTagButton } from "./DeletePromptVersionTagButton";
import type { VersionTagsConfigRow } from "./VersionTagsConfigTable";
import { VersionTagsConfigTable } from "./VersionTagsConfigTable";

export function PromptVersionTagsConfigCard({
  prompt,
}: {
  prompt: PromptVersionTagsConfigCard_data$key;
}) {
  const data = useFragment(
    graphql`
      fragment PromptVersionTagsConfigCard_data on Prompt {
        id
        versionTags {
          id
          name
          description
          promptVersionId
        }
      }
    `,
    prompt
  );
  const tags = useMemo(
    () =>
      data.versionTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        versionId: tag.promptVersionId,
      })),
    [data.versionTags]
  );
  const promptId = data.id;
  const renderDeleteButton = useCallback(
    (tag: VersionTagsConfigRow) => (
      <DeletePromptVersionTagButton
        promptVersionTagId={tag.id}
        promptId={promptId}
      />
    ),
    [promptId]
  );
  return (
    <VersionTagsConfigTable
      ownerId={promptId}
      tags={tags}
      renderDeleteButton={renderDeleteButton}
    />
  );
}
