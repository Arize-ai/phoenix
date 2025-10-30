import { useMemo } from "react";
import {
  Autocomplete,
  Input,
  type MenuProps,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  LazyTabPanel,
  Menu,
  MenuContainer,
  MenuHeader,
  MenuItem,
  MenuTrigger,
  SearchField,
  SelectChevronUpDownIcon,
  Tab,
  TabList,
  Tabs,
  Text,
  TextProps,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  PromptMenuQuery,
  PromptMenuQuery$data,
} from "@phoenix/pages/playground/__generated__/PromptMenuQuery.graphql";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

type PromptItem = {
  type: "prompt" | "version" | "tag";
  /**
   * Prompt or Prompt Version ID
   */
  id: string;
  /**
   * Prompt Name
   */
  name: string;
  /**
   * Prompt or Prompt Version Creation Date
   */
  createdAt?: string;
  /**
   * Prompt Version description
   */
  description?: string;
  /**
   * Prompt Version Tags
   */
  tags?: Omit<PromptItem, "tags" | "versions">[];
  /**
   * May contain prompt versions, prompt tags
   */
  versions: Omit<PromptItem, "versions">[];
};

const createItemsFromPrompts = (
  prompts: PromptMenuQuery$data["prompts"]["edges"]
): PromptItem[] =>
  prompts.map(({ prompt }) => {
    return {
      type: "prompt",
      id: prompt.id,
      name: prompt.name,
      tags:
        (prompt?.versionTags ?? []).map((tag) => ({
          type: "tag",
          id: tag.name,
          name: tag.name,
        })) || [],
      versions: (prompt?.promptVersions?.versions ?? []).map(({ version }) => ({
        type: "version",
        id: version.id,
        name: version.id,
        createdAt: version.createdAt,
        description: version.description || undefined,
        tags:
          version.tags.map((tag) => ({
            type: "tag",
            id: tag.name,
            name: tag.name,
          })) || [],
      })),
    };
  });

export type PromptMenuProps<T extends object> = Omit<
  MenuProps<T>,
  "onChange" | "value"
> & {
  value?: {
    promptId: string;
    promptVersionId: string;
    promptTagName: string | null;
  } | null;
  onChange: (changes: {
    promptId: string | null;
    promptVersionId: string | null;
    promptTagName: string | null;
  }) => void;
};

export const PromptMenu = <T extends object>({
  value,
  onChange,
  ...props
}: PromptMenuProps<T>) => {
  const { promptId, promptVersionId, promptTagName } = value || {};
  const fetchKey = promptVersionId
    ? `PromptMenu:${promptId}:${promptVersionId}`
    : (promptId ?? undefined);
  const data = useLazyLoadQuery<PromptMenuQuery>(
    graphql`
      query PromptMenuQuery {
        prompts(first: 200) {
          edges {
            prompt: node {
              __typename
              ... on Prompt {
                id
                name
                versionTags {
                  name
                }
                promptVersions {
                  versions: edges {
                    version: node {
                      id
                      createdAt
                      description
                      tags {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {},
    { fetchPolicy: "store-and-network", fetchKey }
  );
  const { contains } = useFilter({ sensitivity: "base" });
  const prompts = data.prompts.edges;
  /**
   * All prompts and prompt versions in a flat array
   * There may be duplicate promptIds, but each versionId is unique
   */
  const promptsAndVersions = useMemo(() => {
    return prompts.flatMap(({ prompt }) => {
      return prompt.promptVersions.versions.map(({ version }) => ({
        promptId: prompt.id,
        promptName: prompt.name,
        versionId: version.id,
        tags: version.tags.map((tag) => tag.name) || [],
      }));
    });
  }, [prompts]);
  const promptItems = useMemo(() => createItemsFromPrompts(prompts), [prompts]);
  const selectedPromptDatum = useMemo(() => {
    if (promptTagName) {
      return promptsAndVersions.find(
        (item) =>
          item.promptId === promptId &&
          item.versionId === promptVersionId &&
          item.tags.includes(promptTagName)
      );
    }
    if (promptVersionId) {
      return promptsAndVersions.find(
        (item) =>
          item.versionId === promptVersionId && item.promptId === promptId
      );
    }
    return promptsAndVersions.find((item) => item.promptId === promptId);
  }, [promptId, promptVersionId, promptsAndVersions, promptTagName]);
  const selectedPromptIdKey = selectedPromptDatum?.promptId
    ? [selectedPromptDatum.promptId]
    : undefined;
  const selectedPromptVersionIdKey = selectedPromptDatum?.versionId
    ? [selectedPromptDatum.versionId]
    : undefined;
  const selectedPromptTagNameKey = selectedPromptDatum?.tags.includes(
    promptTagName as string
  )
    ? [promptTagName as string]
    : undefined;

  return (
    <MenuTrigger>
      <Button trailingVisual={<SelectChevronUpDownIcon />} size="S">
        {selectedPromptDatum ? (
          <Flex alignItems="center">
            {selectedPromptDatum.promptName}
            {/* Render priority:
            - selected tag
            - truncated version id
            */}
            {selectedPromptTagNameKey ? (
              <Text color="text-300">
                &nbsp;@{" "}
                <TagVersionLabel>{selectedPromptTagNameKey[0]}</TagVersionLabel>
              </Text>
            ) : (
              <Text color="text-300">
                &nbsp;@ <IdTruncate id={selectedPromptDatum.versionId} />
              </Text>
            )}
          </Flex>
        ) : (
          <Text color="text-300">Select a prompt</Text>
        )}
      </Button>
      <MenuContainer>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search" autoFocus>
              <Input placeholder="Search prompts" />
            </SearchField>
          </MenuHeader>
          <Menu
            {...props}
            selectionMode="single"
            selectedKeys={selectedPromptIdKey}
            items={promptItems}
            renderEmptyState={() => "No prompts found"}
          >
            {function renderMenuItem({ id, name, versions, tags }) {
              // Start by rendering a prompt as a Submenu Item
              return (
                <SubmenuTrigger>
                  <MenuItem>{name}</MenuItem>
                  <MenuContainer
                    placement="end"
                    containerPadding={8}
                    shouldFlip
                  >
                    <Tabs
                      defaultSelectedKey={
                        selectedPromptTagNameKey && (tags?.length ?? 0) > 0
                          ? "tags"
                          : "versions"
                      }
                    >
                      <TabList>
                        <Tab id="versions">Versions</Tab>
                        <Tab id="tags">Tags</Tab>
                      </TabList>
                      <LazyTabPanel id="versions">
                        <Autocomplete filter={contains}>
                          <MenuHeader>
                            <SearchField aria-label="Search" autoFocus>
                              <Input placeholder="Search prompt versions" />
                            </SearchField>
                          </MenuHeader>
                          <Menu
                            items={versions}
                            renderEmptyState={() => (
                              <View padding="size-200">
                                <Text color="text-700">
                                  No prompt versions found
                                </Text>
                              </View>
                            )}
                            selectionMode="single"
                            selectedKeys={selectedPromptVersionIdKey}
                            onSelectionChange={(keys) => {
                              const newSelection =
                                keys instanceof Set
                                  ? keys.values().next().value
                                  : null;
                              onChange(
                                newSelection == null
                                  ? {
                                      promptId: null,
                                      promptVersionId: null,
                                      promptTagName: null,
                                    }
                                  : {
                                      promptId: id,
                                      promptVersionId: newSelection as string,
                                      promptTagName: null,
                                    }
                              );
                            }}
                          >
                            {({ createdAt, name, description }) => (
                              <MenuItem
                                textValue={`${name}\n${description}\n${createdAt}`}
                              >
                                <Flex direction="column" gap="size-100">
                                  <Truncate maxWidth="100%">
                                    {description ? (
                                      <Text>{description}</Text>
                                    ) : (
                                      <Text fontStyle="italic" color="text-300">
                                        No change description
                                      </Text>
                                    )}
                                  </Truncate>
                                  <Flex alignItems="center" gap="size-100">
                                    <IdTruncate
                                      id={name}
                                      textProps={{ size: "S" }}
                                    />
                                    {createdAt && (
                                      <Text size="XS" color="text-300">
                                        {fullTimeFormatter(new Date(createdAt))}
                                      </Text>
                                    )}
                                  </Flex>
                                </Flex>
                              </MenuItem>
                            )}
                          </Menu>
                        </Autocomplete>
                      </LazyTabPanel>
                      <LazyTabPanel id="tags">
                        <Autocomplete filter={contains}>
                          <MenuHeader>
                            <SearchField aria-label="Search" autoFocus>
                              <Input placeholder="Search prompt tags" />
                            </SearchField>
                          </MenuHeader>
                          <Menu
                            items={tags}
                            renderEmptyState={() => (
                              <View padding="size-200">
                                <Text color="text-700">
                                  No prompt tags found
                                </Text>
                              </View>
                            )}
                            selectionMode="single"
                            selectedKeys={
                              selectedPromptDatum?.promptId === id
                                ? selectedPromptTagNameKey
                                : undefined
                            }
                            onSelectionChange={(keys) => {
                              const newSelection =
                                keys instanceof Set
                                  ? keys.values().next().value
                                  : null;
                              onChange(
                                newSelection == null
                                  ? {
                                      promptId: null,
                                      promptVersionId: null,
                                      promptTagName: null,
                                    }
                                  : {
                                      promptId: id,
                                      promptTagName: newSelection as string,
                                      promptVersionId: null,
                                    }
                              );
                            }}
                          >
                            {({ name }) => (
                              <MenuItem textValue={name}>
                                <TagVersionLabel>{name}</TagVersionLabel>
                              </MenuItem>
                            )}
                          </Menu>
                        </Autocomplete>
                      </LazyTabPanel>
                    </Tabs>
                  </MenuContainer>
                </SubmenuTrigger>
              );
            }}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
};

/**
 * Character based truncation for IDs.
 * Truncates from the start, preserving the last 6 characters (by default).
 *
 * Adds underline as an affordance for hovering, to show the un-truncated ID.
 */
export function IdTruncate({
  id,
  length = 6,
  textProps,
}: {
  id: string;
  length?: number;
  textProps?: Partial<TextProps>;
}) {
  const truncatedValue = useMemo(() => {
    if (id.length <= length) return id;
    return id.slice(length * -1);
  }, [id, length]);

  return (
    <Text
      title={id}
      css={css`
        text-decoration: underline;
        text-underline-offset: 4px;
        font-family: monospace;
      `}
      {...textProps}
    >
      {truncatedValue}
    </Text>
  );
}
