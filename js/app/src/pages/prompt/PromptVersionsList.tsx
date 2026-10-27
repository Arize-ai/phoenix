import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";
import { Link, useResolvedPath } from "react-router";

import { Flex, View } from "@phoenix/components";

import type {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";

export type PromptVersionItemProps = {
  version: PromptVersionsList__main$data["pagedVersions"]["edges"][number]["version"];
  active?: boolean;
};

type PromptVersion =
  PromptVersionsList__main$data["pagedVersions"]["edges"][number]["version"];

const promptVersionItemCSS = css`
  border-bottom: 1px solid var(--global-color-gray-300);
  transition: background-color 0.1s ease-in;

  &[data-active="true"],
  &:hover {
    background-color: var(--global-color-gray-200);
  }

  & > a {
    text-decoration: none;
    color: inherit;
  }
`;

/**
 * A single prompt version item, displaying the version number,
 * the date it was created, and tag. Clicking the item navigates to
 * /:versionId under the route that renders the list.
 */
export const PromptVersionItem = ({
  version,
  active,
}: PromptVersionItemProps) => {
  const basePath = useResolvedPath(".").pathname;
  return (
    <div css={promptVersionItemCSS} data-active={active}>
      <Link to={`${basePath}/${version.id}`}>
        <View width="100%" paddingY="size-100" paddingX="size-200">
          <PromptVersionSummary promptVersion={version} />
        </View>
      </Link>
    </div>
  );
};

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
 * Full height, scrollable, list of prompt versions
 */
export const PromptVersionsList = ({
  prompt,
  itemActive,
}: PromptVersionsListProps) => {
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
    >
      <div
        css={promptVersionsListScrollCSS}
        onScroll={(event) => fetchMoreOnBottomReached(event.currentTarget)}
      >
        <Flex direction="column">
          {data.pagedVersions.edges.map(({ version }) => (
            <PromptVersionItem
              key={version.id}
              version={version}
              active={itemActive?.(version)}
            />
          ))}
        </Flex>
      </div>
    </View>
  );
};
