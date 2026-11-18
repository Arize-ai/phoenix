import { graphql, useFragment } from "react-relay";

import type { TagProps } from "@phoenix/components";
import { Tag, TagGroup } from "@phoenix/components";
import { getPromptVersionTagColor } from "@phoenix/constants/promptConstants";

import type { PromptVersionTagsList_data$key } from "./__generated__/PromptVersionTagsList_data.graphql";

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

  return (
    <TagGroup
      aria-label="Version tags"
      items={data.tags.map((tag) => ({
        id: tag.id,
        label: tag.name,
        color: getPromptVersionTagColor(tag.name),
      }))}
    />
  );
}

/**
 * A prompt version tag on its own, colored by its name like every other
 * appearance of that tag.
 */
export function TagVersionLabel({
  children,
  maxWidth,
  size = "M",
}: {
  children: string;
  maxWidth?: TagProps["maxWidth"];
  size?: TagProps["size"];
}) {
  return (
    <Tag
      size={size}
      color={getPromptVersionTagColor(children)}
      maxWidth={maxWidth}
    >
      {children}
    </Tag>
  );
}
