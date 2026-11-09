import { graphql, useFragment } from "react-relay";
import { useResolvedPath } from "react-router";

import { LatestVersionsList } from "@phoenix/components/versions/LatestVersionsList";

import type { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";

export function PromptLatestVersionsList(props: {
  prompt: PromptLatestVersionsListFragment$key;
}) {
  const { prompt } = props;
  const basePath = useResolvedPath(".").pathname;
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
  const versions = data?.latestVersions?.edges?.map((edge) => edge.version);

  if (!versions) {
    throw new Error("Expected prompt versions to be defined");
  }

  return (
    <LatestVersionsList
      versions={versions}
      renderVersion={(version) => (
        <PromptVersionSummary promptVersion={version} />
      )}
      viewAllTo={`${basePath}/versions`}
    />
  );
}
