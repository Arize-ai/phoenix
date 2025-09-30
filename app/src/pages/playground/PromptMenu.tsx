import { useMemo } from "react";
import {
  Autocomplete,
  Collection,
  Header,
  Input,
  type MenuProps,
  MenuSection,
  SubmenuTrigger,
  useFilter,
} from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  SelectChevronUpDownIcon,
  Text,
  TextProps,
  Token,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import {
  PromptMenuQuery,
  PromptMenuQuery$data,
} from "@phoenix/pages/playground/__generated__/PromptMenuQuery.graphql";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

type PromptItem = {
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
   * May contain prompt versions, prompt tags
   */
  children: {
    /**
     * "version", "tag", etc
     */
    id: string;
    /**
     * "Versions", "Tags", etc
     */
    section: string;
    /**
     * The content of the section
     */
    children: Omit<PromptItem, "children">[];
  }[];
};

const createItemsFromPrompts = (
  prompts: PromptMenuQuery$data["prompts"]["edges"]
): PromptItem[] =>
  prompts.map(({ prompt }) => {
    return {
      id: prompt.id,
      name: prompt.name,
      children: [
        {
          id: "version",
          section: "Versions",
          children: prompt.promptVersions.versions.map(({ version }) => ({
            id: version.id,
            name: version.id,
            createdAt: version.createdAt,
            description: version.description || undefined,
          })),
        },
      ],
    };
  });

export type PromptMenuProps<T extends object> = MenuProps<T> & {
  value?: {
    promptId: string;
    promptVersionId: string;
  } | null;
  onChange: (changes: {
    promptId: string | null;
    promptVersionId: string | null;
  }) => void;
};

export const PromptMenu = <T extends object>({
  value,
  onChange,
  ...props
}: PromptMenuProps<T>) => {
  const { promptId, promptVersionId } = value || {};
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
                promptVersions {
                  versions: edges {
                    version: node {
                      id
                      createdAt
                      description
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
      return prompt.promptVersions.versions
        .map(({ version }) => ({
          promptId: prompt.id,
          promptName: prompt.name,
          versionId: version.id,
        }))
        .sort((a, b) => {
          // ensure those without versionId are first
          if (!a.versionId && b.versionId) return -1;
          if (a.versionId && !b.versionId) return 1;
          return 0;
        });
    });
  }, [prompts]);
  const promptItems = useMemo(() => createItemsFromPrompts(prompts), [prompts]);
  const selectedPromptDatum = useMemo(() => {
    if (promptVersionId) {
      return promptsAndVersions.find(
        (item) => item.versionId === promptVersionId
      );
    }
    return promptsAndVersions.find((item) => item.promptId === promptId);
  }, [promptId, promptVersionId, promptsAndVersions]);
  const isLatestVersionSelected = useMemo(() => {
    if (!selectedPromptDatum) return false;
    const latestVersion = promptItems
      .find((prompt) => prompt.id === selectedPromptDatum.promptId)
      ?.children?.find((child) => child.section === "Versions")
      ?.children?.[0]?.id;
    return latestVersion === selectedPromptDatum.versionId;
  }, [selectedPromptDatum, promptItems]);
  const selectedPromptIdKey = selectedPromptDatum?.promptId
    ? [selectedPromptDatum.promptId]
    : undefined;
  const selectedPromptVersionIdKey = selectedPromptDatum?.versionId
    ? [selectedPromptDatum.versionId]
    : undefined;

  return (
    <MenuTrigger>
      <Button trailingVisual={<SelectChevronUpDownIcon />} size="S">
        {selectedPromptDatum ? (
          <Flex alignItems="center">
            {selectedPromptDatum.promptName}
            {isLatestVersionSelected ? (
              <View marginStart={"size-100"}>
                <Token color="var(--ac-global-color-info)">latest</Token>
              </View>
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
      <Popover
        css={css`
          overflow: auto;
        `}
      >
        <Autocomplete filter={contains}>
          <View paddingX="size-100" marginTop="size-100">
            <SearchField aria-label="Search" autoFocus>
              <Input placeholder="Search prompts" />
            </SearchField>
          </View>
          <Menu
            {...props}
            selectionMode="single"
            selectedKeys={selectedPromptIdKey}
            items={promptItems}
            renderEmptyState={() => "No prompts found"}
          >
            {function renderMenuItem({ id, name, children }) {
              // Start by rendering a prompt as a Submenu Item
              return (
                <SubmenuTrigger>
                  <MenuItem>{name}</MenuItem>
                  <Popover
                    css={css`
                      overflow: auto;
                    `}
                  >
                    <Menu
                      items={children}
                      renderEmptyState={() => "No prompt versions found"}
                    >
                      {(section) => (
                        <MenuSection
                          selectionMode="single"
                          selectedKeys={selectedPromptVersionIdKey}
                          items={section.children}
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
                                  }
                                : {
                                    promptId: id,
                                    promptVersionId: newSelection as string,
                                  }
                            );
                          }}
                        >
                          <Header>
                            <Flex
                              justifyContent="space-between"
                              alignItems="center"
                              margin="size-100"
                            >
                              <Text weight="heavy">{section.section}</Text>
                              <Text size="S">({section.children.length})</Text>
                            </Flex>
                          </Header>

                          <Collection items={section.children}>
                            {({ createdAt, name, description }) => (
                              <MenuItem>
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
                                  <Flex
                                    justifyContent="space-between"
                                    alignItems="center"
                                    gap="size-400"
                                  >
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
                          </Collection>
                        </MenuSection>
                      )}
                    </Menu>
                  </Popover>
                </SubmenuTrigger>
              );
            }}
          </Menu>
        </Autocomplete>
      </Popover>
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
      fontFamily="mono"
      css={css`
        text-decoration: underline;
        text-underline-offset: 3px;
      `}
      {...textProps}
    >
      {truncatedValue}
    </Text>
  );
}
