import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Text } from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";

import { PromptLatestVersionsListFragment$key } from "./__generated__/PromptLatestVersionsListFragment.graphql";

const versionListItemCSS = css`
  padding-bottom: var(--ac-global-dimension-size-300);
  position: relative;
`;
export function PromptLatestVersionsList(props: {
  prompt: PromptLatestVersionsListFragment$key;
}) {
  const { prompt } = props;
  const data = useFragment<PromptLatestVersionsListFragment$key>(
    graphql`
      fragment PromptLatestVersionsListFragment on Prompt {
        promptVersions(first: 5) {
          edges {
            version: node {
              id
              ... on PromptVersion {
                description
              }
            }
          }
        }
      }
    `,
    prompt
  );
  const versions = useMemo(() => {
    return data?.promptVersions?.edges?.map((edge) => edge.version);
  }, [data]);

  if (!versions) {
    throw new Error("Expected prompt versions to be defined");
  }

  const numVersions = versions.length;
  return (
    <ul>
      {versions.map((version, i) => {
        return (
          <li key={version.id} css={versionListItemCSS}>
            <Flex direction="row" gap="size-200" alignItems="start">
              <Icon svg={<Icons.Commit />} />
              <Flex direction="column">
                <span>{version.id}</span>
                <Text color="text-700">{version.description}</Text>
              </Flex>
            </Flex>
            <VersionsConnector />
          </li>
        );
      })}
    </ul>
  );
}

const versionsConnectorCSS = css`
  position: absolute;
  top: 24px;
  left: 9px;
  height: calc(100% - 28px);
  border-right: 2px dashed var(--ac-global-color-grey-500);
`;
function VersionsConnector() {
  return <div css={versionsConnectorCSS} />;
}
