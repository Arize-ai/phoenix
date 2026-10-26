import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionVersionTagsList_data$key } from "./__generated__/DecisionVersionTagsList_data.graphql";

export function DecisionVersionTagsList({
  decisionVersion,
}: {
  decisionVersion: DecisionVersionTagsList_data$key;
}) {
  const data = useFragment<DecisionVersionTagsList_data$key>(
    graphql`
      fragment DecisionVersionTagsList_data on DecisionVersion {
        tags {
          id
          name
        }
      }
    `,
    decisionVersion
  );
  return (
    <Flex direction="row" gap="size-50" alignItems="center" wrap="wrap">
      {data.tags.map((tag) => (
        <TagVersionLabel key={tag.id}>{tag.name}</TagVersionLabel>
      ))}
    </Flex>
  );
}
