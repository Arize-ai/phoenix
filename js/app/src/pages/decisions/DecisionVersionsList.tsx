import { graphql, usePaginationFragment } from "react-relay";

import {
  VersionListItem,
  VersionsListContainer,
} from "@phoenix/components/versions/VersionsList";

import type { DecisionVersionsList_versions$key } from "./__generated__/DecisionVersionsList_versions.graphql";
import type { DecisionVersionsListQuery } from "./__generated__/DecisionVersionsListQuery.graphql";
import { DecisionVersionSummary } from "./DecisionVersionSummary";

const PAGE_SIZE = 50;

/**
 * Full height, scrollable, list of decision versions
 */
export function DecisionVersionsList({
  decisionRef,
  decisionId,
  selectedVersionId,
}: {
  decisionRef: DecisionVersionsList_versions$key;
  decisionId: string;
  selectedVersionId: string | null;
}) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    DecisionVersionsListQuery,
    DecisionVersionsList_versions$key
  >(
    graphql`
      fragment DecisionVersionsList_versions on Decision
      @refetchable(queryName: "DecisionVersionsListQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String" }
      ) {
        pagedVersions: versions(first: $first, after: $after)
          @connection(key: "DecisionVersionsList_pagedVersions") {
          edges {
            node {
              id
              ...DecisionVersionSummary_version
            }
          }
        }
      }
    `,
    decisionRef
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
      {data.pagedVersions.edges.map(({ node: version }) => (
        <VersionListItem
          key={version.id}
          to={`/prompts/decisions/${decisionId}/versions/${version.id}`}
          active={version.id === selectedVersionId}
        >
          <DecisionVersionSummary versionRef={version} />
        </VersionListItem>
      ))}
    </VersionsListContainer>
  );
}
