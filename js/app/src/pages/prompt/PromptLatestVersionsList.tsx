import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import type { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";
import { LatestVersionsTimeline } from "./LatestVersionsTimeline";
import { PromptVersionSummary } from "./PromptVersionSummary";

export function PromptLatestVersionsList(props: {
  prompt: PromptLatestVersionsListFragment$key;
}) {
  const { prompt } = props;
  const data = useFragment<PromptLatestVersionsListFragment$key>(
    graphql`
      fragment PromptLatestVersionsListFragment on Prompt {
        latestVersions: promptVersions(first: 5) {
          edges {
            version: node {
              id
              ... on PromptVersion {
                description
                createdAt
                sequenceNumber
                ...PromptVersionSummaryFragment
              }
            }
          }
        }
      }
    `,
    prompt
  );
  const items = useMemo(() => {
    const versions = data?.latestVersions?.edges?.map((edge) => edge.version);
    if (!versions) {
      throw new Error("Expected prompt versions to be defined");
    }
    return versions.map((version) => ({
      id: version.id,
      sequenceNumber: version.sequenceNumber,
      summary: <PromptVersionSummary promptVersion={version} />,
    }));
  }, [data]);

  return <LatestVersionsTimeline items={items} />;
}
