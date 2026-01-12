import { graphql, useFragment } from "react-relay";

import { Flex } from "@phoenix/components";
import { PromptBadge } from "@phoenix/components/prompt";

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
        <PromptBadge key={tag.id} tag={tag.name} />
      ))}
    </Flex>
  );
}
