import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";
import { useLocation, useResolvedPath } from "react-router";

import { Timeline, View } from "@phoenix/components";

import type {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";
import { PromptVersionTimelineItem } from "./PromptVersionSummary";

type PromptVersion =
  PromptVersionsList__main$data["pagedVersions"]["edges"][number]["version"];

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

const PROMPT_VERSIONS_LIST_WIDTH = 400;

const PAGE_SIZE = 50;

const promptVersionsListScrollCSS = css`
  height: 100%;
  overflow: auto;
`;

/**
 * Full height, scrollable, timeline of prompt versions. Each version links
 * to :versionId under the route that renders the list.
 */
export const PromptVersionsList = ({
  prompt,
  itemActive,
}: PromptVersionsListProps) => {
  const basePath = useResolvedPath(".").pathname;
  const { search } = useLocation();
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    graphql`
      fragment PromptVersionsList__main on Prompt
      @refetchable(queryName: "PromptVersionsListPaginationQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 50 }
      ) {
        pagedVersions: promptVersions(first: $first, after: $after)
          @connection(key: "PromptVersionsList__pagedVersions") {
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
  const fetchMoreOnBottomReached = (scrollContainer: HTMLDivElement) => {
    const { scrollHeight, scrollTop, clientHeight } = scrollContainer;
    if (
      scrollHeight - scrollTop - clientHeight < 300 &&
      !isLoadingNext &&
      hasNext
    ) {
      loadNext(PAGE_SIZE);
    }
  };
  return (
    <View
      height="100%"
      width={PROMPT_VERSIONS_LIST_WIDTH}
      minWidth={PROMPT_VERSIONS_LIST_WIDTH}
      borderRightWidth="thin"
      borderColor="gray-300"
      padding="size-100"
    >
      <div
        css={promptVersionsListScrollCSS}
        onScroll={(event) => fetchMoreOnBottomReached(event.currentTarget)}
      >
        <Timeline isTruncated={hasNext}>
          {data.pagedVersions.edges.map(({ version }) => (
            <PromptVersionTimelineItem
              key={version.id}
              promptVersion={version}
              to={`${basePath}/${version.id}${search}`}
              isCurrent={itemActive?.(version)}
            />
          ))}
        </Timeline>
      </div>
    </View>
  );
};
