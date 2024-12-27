import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { Link } from "react-router-dom";
import { css } from "@emotion/react";

import { Text } from "@arizeai/components";

import { Flex, View } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

import {
  PromptVersionsList__main$data,
  PromptVersionsList__main$key,
} from "./__generated__/PromptVersionsList__main.graphql";

export type PromptVersionItemProps = {
  version: PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];
  active?: boolean;
};

type PromptVersion =
  PromptVersionsList__main$data["promptVersions"]["edges"][number]["version"];

const promptVersionItemCSS = ({ active }: { active?: boolean }) => css`
  & {
    border-bottom: 1px solid var(--ac-global-color-grey-300);
    transition: background-color 0.1s ease-in;
  }

  & > a {
    height: 100%;
    width: 100%;
    justify-content: flex-start;
    padding: 0;
    border-radius: 0;
    border: none;
    text-decoration: none;
    background-opacity: 0;
    & > * {
      background-color: ${active ? "var(--ac-global-color-grey-200)" : "auto"};
    }
    &:hover,
    &:focus-visible {
      outline: none;
      & > * {
        outline: none;
        background-color: ${active
          ? "var(--ac-global-color-grey-200)"
          : "var(--ac-global-color-grey-100)"};
      }
    }
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
  const styles = useMemo(() => promptVersionItemCSS({ active }), [active]);
  return (
    <div css={styles}>
      <Link to={`${version.id}`}>
        <Flex width="100%" height={96} direction="row">
          <View width="100%" padding="size-200">
            <Flex direction="column">
              <Text>{version.id}</Text>
              <Truncate maxWidth={"100%"}>
                <Text>{version.description}</Text>
              </Truncate>
            </Flex>
          </View>
        </Flex>
      </Link>
    </div>
  );
};

type PromptVersionsListProps = {
  prompt: PromptVersionsList__main$key;
  itemActive?: (version: PromptVersion) => boolean;
};

const PROMPT_VERSIONS_LIST_WIDTH = 300;

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
