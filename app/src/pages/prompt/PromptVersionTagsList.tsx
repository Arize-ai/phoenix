import React from "react";
import { graphql, useFragment } from "react-relay";

import { Tag, TagGroup, TagList } from "@phoenix/components";

import { PromptVersionTagsList_data$key } from "./__generated__/PromptVersionTagsList_data.graphql";

export function PromptVersionTagsList({
  promptVersion,
}: {
  promptVersion: PromptVersionTagsList_data$key;
}) {
  const data = useFragment<PromptVersionTagsList_data$key>(
    graphql`
      fragment PromptVersionTagsList_data on PromptVersion {
        tags {
          id
          name
        }
      }
    `,
    promptVersion
  );

  const tags = data.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
  }));
  return (
    <TagGroup aria-label="Prompt Version Tags">
      <TagList items={tags}>{(tag) => <Tag>{tag.name}</Tag>}</TagList>
    </TagGroup>
  );
}
