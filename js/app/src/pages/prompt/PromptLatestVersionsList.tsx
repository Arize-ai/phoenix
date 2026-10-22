import { graphql, useFragment } from "react-relay";
import { useResolvedPath } from "react-router";

import { Flex, Link, Timeline } from "@phoenix/components";

import type { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";
import { PromptVersionTimelineItem } from "./PromptVersionSummary";

export function PromptLatestVersionsList(props: {
  prompt: PromptLatestVersionsListFragment$key;
}) {
  const { prompt } = props;
  const basePath = useResolvedPath(".").pathname;
  const data = useFragment<PromptLatestVersionsListFragment$key>(
    graphql`
      fragment PromptLatestVersionsListFragment on Prompt {
        latestVersions: promptVersions(first: 5) {
          pageInfo {
            hasNextPage
          }
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
  const { latestVersions } = data;

  return (
    <Flex direction="column" gap="size-100">
      <Timeline isTruncated={latestVersions.pageInfo.hasNextPage}>
        {latestVersions.edges.map(({ version }) => (
          <PromptVersionTimelineItem key={version.id} promptVersion={version} />
        ))}
      </Timeline>
      <Flex direction="row" justifyContent="end">
        <Link to={`${basePath}/versions`}>View all versions</Link>
      </Flex>
    </Flex>
  );
}
