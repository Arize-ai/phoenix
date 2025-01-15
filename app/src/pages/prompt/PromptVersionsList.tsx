import React from "react";
import { graphql, useFragment } from "react-relay";
import { Link } from "react-router-dom";
import { formatRelative } from "date-fns";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

import {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";
import { PromptVersionTagsList } from "./PromptVersionTagsList";

export type PromptVersionItemProps = {
  version: PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];
  active?: boolean;
};

type PromptVersion =
  PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];

const promptVersionItemCSS = css`
  border-bottom: 1px solid var(--ac-global-color-grey-300);
  transition: background-color 0.1s ease-in;

  &[data-active="true"],
  &:hover {
    background-color: var(--ac-global-color-grey-200);
  }

  & > a {
    text-decoration: none;
    color: inherit;
  }
`;

/**
 * A single prompt version item, displaying the version number,
 * the date it was created, and tag. Clicking the item will
 * add /:versionId to the current path
 */
export const PromptVersionItem = ({
  version,
  active,
}: PromptVersionItemProps) => {
  return (
    <div css={promptVersionItemCSS} data-active={active}>
      <Link to={`${version.id}`}>
        <View width="100%" paddingY="size-100" paddingX="size-200">
          <Flex direction="column" gap="size-50">
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
            <Truncate maxWidth={"100%"}>
              <Text color="text-700">{version.description}</Text>
            </Truncate>
            <PromptVersionTagsList promptVersion={version} />
          </Flex>
        </View>
      </Link>
    </div>
  );
};

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

const PROMPT_VERSIONS_LIST_WIDTH = 350;

/**
 * Full height, scrollable, list of prompt versions
 */
export const PromptVersionsList = ({
  prompt,
  itemActive,
}: PromptVersionsListProps) => {
  const { promptVersions } = useFragment(
    graphql`
      fragment PromptVersionsList__main on Prompt {
        promptVersions {
          edges {
            version: node {
              id
              ... on PromptVersion {
                id
                description
                createdAt
                ...PromptVersionTagsList_data
              }
            }
          }
        }
      }
    `,
    prompt
  );
  return (
    <View
      height="100%"
      overflow="auto"
      width={PROMPT_VERSIONS_LIST_WIDTH}
      minWidth={PROMPT_VERSIONS_LIST_WIDTH}
      borderRightWidth="thin"
      borderColor="grey-300"
    >
      <Flex direction="column">
        {promptVersions.edges.map(({ version }) => (
          <PromptVersionItem
            key={version.id}
            version={version}
            active={itemActive?.(version)}
          />
        ))}
      </Flex>
    </View>
  );
};
