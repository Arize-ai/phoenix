import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Link } from "@phoenix/components";

import { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";

const versionListItemCSS = css`
  padding-bottom: var(--ac-global-dimension-size-200);
  position: relative;
`;
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
  const versions = useMemo(() => {
    return data?.latestVersions?.edges?.map((edge) => edge.version);
  }, [data]);

  if (!versions) {
    throw new Error("Expected prompt versions to be defined");
  }

  return (
    <div>
      <ul>
        {versions.map((version) => {
          return (
            <li key={version.id} css={versionListItemCSS}>
              <PromptVersionSummary promptVersion={version} />
              {/* TODO(prompts): show that there are more */}
              {version.sequenceNumber != 1 ? <VersionsConnector /> : null}
            </li>
          );
        })}
      </ul>
      <Flex direction="row" justifyContent="end">
        <Link to="versions">View all versions</Link>
      </Flex>
    </div>
  );
}

const versionsConnectorCSS = css`
  position: absolute;
  top: 25px;
  left: 10px;
  height: calc(100% - 32px);
  border-right: 2px dashed var(--ac-global-color-grey-500);
`;
function VersionsConnector() {
  return <div css={versionsConnectorCSS} />;
}
