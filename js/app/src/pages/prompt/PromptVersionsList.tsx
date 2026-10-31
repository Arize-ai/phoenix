import { graphql, usePaginationFragment } from "react-relay";
import { useResolvedPath } from "react-router";

import {
  VersionListItem,
  VersionsListContainer,
} from "@phoenix/components/versions/VersionsList";

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
    <VersionListItem to={`${basePath}/${version.id}`} active={active}>
      <PromptVersionSummary promptVersion={version} />
    </VersionListItem>
  );
};

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

const PAGE_SIZE = 50;

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
    <VersionsListContainer onScroll={fetchMoreOnBottomReached}>
      {data.pagedVersions.edges.map(({ version }) => (
        <PromptVersionItem
          key={version.id}
          version={version}
          active={itemActive?.(version)}
        />
      ))}
    </VersionsListContainer>
  );
};
