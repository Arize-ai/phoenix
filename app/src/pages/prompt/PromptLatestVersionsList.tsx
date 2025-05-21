import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Link } from "@phoenix/components";

import { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";
import { PromptVersionSummary } from "./PromptVersionSummary";

const NUM_VERSIONS_TO_SHOW = 5;

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
        {versions.map((version, index) => {
          const isLastConnector = index === NUM_VERSIONS_TO_SHOW - 1;
          return (
            <li key={version.id} css={versionListItemCSS}>
              <PromptVersionSummary promptVersion={version} />
              {version.sequenceNumber != 1 ? (
                <VersionsConnector isLastConnector={isLastConnector} />
              ) : null}
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
  left: 11px;
  height: calc(100% - 32px);
  width: 2px;
  --connector-color: var(--ac-global-color-grey-400);
  background: repeating-linear-gradient(
      to bottom,
      transparent 0 4px,
      var(--ac-global-color-grey-50) 4px 8px
    ),
    var(--connector-color);
  background-size: 4px 100%;
  background-position: 80%;
  background-repeat: no-repeat;
  &[data-last="true"] {
    background: repeating-linear-gradient(
        to bottom,
        transparent 0 4px,
        var(--ac-global-color-grey-50) 4px 8px
      ),
      linear-gradient(to bottom, var(--connector-color), transparent);
  }
`;

/**
 */
function VersionsConnector({ isLastConnector }: { isLastConnector?: boolean }) {
  return <div css={versionsConnectorCSS} data-last={isLastConnector} />;
}
