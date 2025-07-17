import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Token, TokenProps } from "@phoenix/components";

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
  const color: TokenProps["color"] = useMemo(() => {
    switch (children) {
      case "production":
        return "var(--ac-global-color-green-1000)";
      case "staging":
        return "var(--ac-global-color-yellow-1000)";
      case "development":
        return "var(--ac-global-color-blue-1000)";
      default:
        return "var(--ac-global-color-grey-900)";
    }
  }, [children]);
  return <Token color={color}>{children}</Token>;
}
