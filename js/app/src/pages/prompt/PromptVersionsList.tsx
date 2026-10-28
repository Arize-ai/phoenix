import { graphql, useFragment } from "react-relay";
import { useResolvedPath } from "react-router";

import { Timeline, View } from "@phoenix/components";

import type {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";
import { PromptVersionTimelineItem } from "./PromptVersionSummary";

type PromptVersion =
  PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

const PROMPT_VERSIONS_LIST_WIDTH = 400;

/**
 * Full height, scrollable, timeline of prompt versions. Each version links
 * to :versionId under the route that renders the list.
 */
export const PromptVersionsList = ({
  prompt,
  itemActive,
}: PromptVersionsListProps) => {
  const basePath = useResolvedPath(".").pathname;
  const { promptVersions } = useFragment(
    graphql`
      fragment PromptVersionsList__main on Prompt {
        promptVersions {
          edges {
            version: node {
              id
              ... on PromptVersion {
                ...PromptVersionSummaryFragment
              }
            }
          }
        }
      }
    `,
    prompt
  );
  return (
    <View
      height="100%"
      overflow="auto"
      width={PROMPT_VERSIONS_LIST_WIDTH}
      minWidth={PROMPT_VERSIONS_LIST_WIDTH}
      borderRightWidth="thin"
      borderColor="gray-300"
      padding="size-100"
    >
      <Timeline>
        {promptVersions.edges.map(({ version }) => (
          <PromptVersionTimelineItem
            key={version.id}
            promptVersion={version}
            to={`${basePath}/${version.id}`}
            isCurrent={itemActive?.(version)}
          />
        ))}
      </Timeline>
    </View>
  );
};
