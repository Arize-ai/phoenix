import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import type { TokenProps } from "@phoenix/components";
import { Flex, Token } from "@phoenix/components";
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
    <Flex direction="row" gap="size-50" alignItems="center" wrap="wrap">
      {data.tags.map((tag) => (
        <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
      ))}
    </Flex>
  );
}

export function TagVersionLabel({
  children,
  maxWidth,
  size = "M",
}: {
  children: string;
  maxWidth?: TokenProps["maxWidth"];
  size?: TokenProps["size"];
}) {
  const color: TokenProps["color"] = useMemo(
    () => getPromptVersionTagColor(children),
    [children]
  );
  return (
    <Token size={size} color={color} maxWidth={maxWidth} title={children}>
      {children}
    </Token>
  );
}
