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
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  SelectChevronUpDownIcon,
  Text,
  Token,
  View,
} from "@phoenix/components";
import {
  PromptMenuQuery,
  PromptMenuQuery$data,
} from "@phoenix/pages/playground/__generated__/PromptMenuQuery.graphql";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

type PromptItem = {
  id: string;
  name: string;
  createdAt?: string;
  children?: Omit<PromptItem, "children">[];
};

const createItemsFromPrompts = (
  prompts: PromptMenuQuery$data["prompts"]["edges"]
): PromptItem[] =>
  prompts.map(({ prompt }) => {
    return {
      id: prompt.id,
      name: prompt.name,
      children: prompt.promptVersions.versions.map(({ version }) => ({
        id: version.id,
        name: version.id,
        createdAt: version.createdAt,
      })),
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
    const latestVersion = promptItems.find(
      (prompt) => prompt.id === selectedPromptDatum.promptId
    )?.children?.[0]?.id;
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
      <Flex gap="size-100" alignItems="center">
        <Button trailingVisual={<SelectChevronUpDownIcon />} size="S">
          {selectedPromptDatum?.promptName}
        </Button>
        {selectedPromptDatum?.versionId ? (
          <Text size="S" color="text-300" weight="heavy">
            {" "}
            {isLatestVersionSelected ? (
              <Token color="var(--ac-global-color-info)">latest</Token>
            ) : (
              <Token>{selectedPromptDatum.versionId}</Token>
            )}
          </Text>
        ) : null}
      </Flex>
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
            {function renderMenuItem({ id, name, children, createdAt }) {
              // prompts have versions, therefore children, they get rendered in this block
              if (children) {
                return (
                  <SubmenuTrigger>
                    <MenuItem key={id}>{name}</MenuItem>
                    <Popover
                      css={css`
                        overflow: auto;
                      `}
                    >
                      <Autocomplete filter={contains}>
                        <View paddingX="size-100" marginTop="size-100">
                          <SearchField aria-label="Search" autoFocus>
                            <Input placeholder="Search prompt versions" />
                          </SearchField>
                        </View>
                        <Menu
                          items={children}
                          selectionMode="single"
                          selectedKeys={selectedPromptVersionIdKey}
                          renderEmptyState={() => "No prompt versions found"}
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
                          {(item) => renderMenuItem(item)}
                        </Menu>
                      </Autocomplete>
                    </Popover>
                  </SubmenuTrigger>
                );
              }
              // prompt versions will not have children, this is where they are rendered
              return (
                <MenuItem key={id}>
                  <Flex direction="column" gap="size-100">
                    {createdAt && (
                      <Text size="XS" color="text-300">
                        {fullTimeFormatter(new Date(createdAt))}
                      </Text>
                    )}
                    {name}
                  </Flex>
                </MenuItem>
              );
            }}
          </Menu>
        </Autocomplete>
      </Popover>
    </MenuTrigger>
  );
};
