import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Label } from "@arizeai/components";

import { Flex } from "@phoenix/components";
import { ColorValue } from "@phoenix/components/types";

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

  return (
    <Flex direction="row" gap="size-50" alignItems="center" wrap="wrap">
      {data.tags.map((tag) => (
        <VersionLabel key={tag.id}>{tag.name}</VersionLabel>
      ))}
    </Flex>
  );
}

function VersionLabel({ children }: { children: string }) {
  const color: ColorValue = useMemo(() => {
    switch (children) {
      case "production":
        return "green-1000";
      case "staging":
        return "yellow-1000";
      case "development":
        return "blue-1000";
      default:
        return "grey-900";
    }
  }, [children]);
  return <Label color={color}>{children}</Label>;
}
