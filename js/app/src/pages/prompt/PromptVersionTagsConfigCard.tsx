import { graphql, useFragment } from "react-relay";

import type { VersionTagRow } from "@phoenix/components/versions/VersionTagsConfigCard";
import { VersionTagsConfigCard } from "@phoenix/components/versions/VersionTagsConfigCard";

import type { PromptVersionTagsConfigCard_data$key } from "./__generated__/PromptVersionTagsConfigCard_data.graphql";
import { DeletePromptVersionTagButton } from "./DeletePromptVersionTagButton";

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
  const promptId = data.id;
  const getVersionPath = (versionId: string) =>
    `/prompts/${promptId}/versions/${versionId}`;
  const renderDeleteButton = (tag: VersionTagRow) => (
    <DeletePromptVersionTagButton
      promptVersionTagId={tag.id}
      promptId={promptId}
      // We set the key here because aria-components will keep the dialog open on the row that replaces it after delete
      key={tag.id}
    />
  );
  return (
    <VersionTagsConfigCard
      tags={data.versionTags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        versionId: tag.promptVersionId,
      }))}
      getVersionPath={getVersionPath}
      renderDeleteButton={renderDeleteButton}
    />
  );
}
