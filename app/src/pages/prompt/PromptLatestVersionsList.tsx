import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { formatRelative } from "date-fns";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, View } from "@phoenix/components";

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
        latestVersions: promptVersions(first: 5) {
          edges {
            version: node {
              id
              ... on PromptVersion {
                description
                createdAt
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
    <ul>
      {versions.map((version) => {
        return (
          <li key={version.id} css={versionListItemCSS}>
            <Flex direction="row" gap="size-200" alignItems="start">
              <Icon svg={<Icons.Commit />} />
              <Flex direction="column" width="100%" gap="size-50">
                <View width="100%">
                  <Flex
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                  >
                    <span>{version.id}</span>
                    <Text color="text-300">
                      {formatRelative(version.createdAt, Date.now())}
                    </Text>
                  </Flex>
                </View>
                <Text color="text-700">{version.description}</Text>
              </Flex>
            </Flex>
            {/* TODO(prompts): show that there are more */}
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
