import { useMemo } from "react";
import { Autocomplete, Input, useFilter } from "react-aria-components";
import { useLazyLoadQuery } from "react-relay";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import {
  Button,
  CompositeField,
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
  Token,
  View,
} from "@phoenix/components";
import { SearchIcon } from "@phoenix/components/field";
import { PromptBadge } from "@phoenix/components/prompt";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks";
import { PromptMenuQuery } from "@phoenix/pages/playground/__generated__/PromptMenuQuery.graphql";

/** Minimum number of items before showing search field */
const SEARCH_THRESHOLD = 10;

export type PromptVersion = {
  id: string;
  createdAt: string;
  description: string | null;
  isLatest: boolean;
  tags: readonly { name: string }[];
};

export type PromptData = {
  id: string;
  name: string;
  versionTags: readonly { name: string }[];
  versions: readonly PromptVersion[];
};

export type PromptMenuValue = {
  promptId: string;
  promptVersionId: string;
  promptTagName: string | null;
};

export type PromptMenuProps = {
  value?: PromptMenuValue | null;
  onChange: (changes: {
    promptId: string | null;
    promptVersionId: string | null;
    promptTagName: string | null;
  }) => void;
};

/**
 * A composite dropdown for selecting prompts and their versions.
 * - Left dropdown: Searchable prompt list. Clicking a prompt selects it with the latest version.
 * - Right dropdown: Version/tag selector. Defaults to "latest", allows switching versions.
 */
export const PromptMenu = ({ value, onChange }: PromptMenuProps) => {
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
                      isLatest
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

  // Transform GraphQL data into a more usable format
  const prompts: PromptData[] = useMemo(() => {
    return data.prompts.edges.map(({ prompt }) => ({
      id: prompt.id,
      name: prompt.name,
      versionTags: prompt.versionTags ?? [],
      versions: (prompt.promptVersions?.versions ?? []).map(({ version }) => ({
        id: version.id,
        createdAt: version.createdAt,
        description: version.description ?? null,
        isLatest: version.isLatest,
        tags: version.tags,
      })),
    }));
  }, [data]);

  // Find the currently selected prompt
  const selectedPrompt = useMemo(() => {
    if (!promptId) return null;
    return prompts.find((p) => p.id === promptId) ?? null;
  }, [promptId, prompts]);

  // Find the currently selected version info
  const selectedVersionInfo = useMemo(() => {
    if (!selectedPrompt || !promptVersionId) return null;
    return (
      selectedPrompt.versions.find((v) => v.id === promptVersionId) ?? null
    );
  }, [selectedPrompt, promptVersionId]);

  const handleSelectPrompt = (newPromptId: string) => {
    const prompt = prompts.find((p) => p.id === newPromptId);
    if (!prompt) return;

    // Use isLatest bool if available, else fall back to latest in list.
    const latestMarked = prompt.versions.find((v) => v.isLatest);
    const latestVersion = latestMarked ?? prompt.versions[0];

    // Bail if prompt has zero versions (shouldn't be possible)
    if (!latestVersion) return;

    onChange({
      promptId: newPromptId,
      promptVersionId: latestVersion.id,
      promptTagName: null,
    });
  };

  const handleSelectVersion = (versionId: string) => {
    if (!promptId) return;
    onChange({
      promptId,
      promptVersionId: versionId,
      promptTagName: null,
    });
  };

  const handleSelectTag = (tagName: string) => {
    if (!promptId) return;
    onChange({
      promptId,
      promptTagName: tagName,
      promptVersionId: null,
    });
  };

  if (selectedPrompt) {
    return (
      <div css={promptMenuContainerCSS}>
        <CompositeField>
          <PromptSelector
            prompts={prompts}
            selectedPrompt={selectedPrompt}
            onSelectPrompt={handleSelectPrompt}
          />
          <PromptVersionSelector
            prompt={selectedPrompt}
            selectedVersionInfo={selectedVersionInfo}
            selectedTagName={promptTagName}
            onSelectVersion={handleSelectVersion}
            onSelectTag={handleSelectTag}
          />
        </CompositeField>
      </div>
    );
  }

  return (
    <div css={promptMenuContainerCSS}>
      <PromptSelector
        prompts={prompts}
        selectedPrompt={selectedPrompt}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
};

const promptMenuContainerCSS = css`
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
`;

/**
 * Width strategy for PromptSelector:
 *
 * The button width is controlled by these factors:
 * - min-width: Ensures the button is always usably wide
 * - max-width (placeholder): Prevents "Select prompt" from stretching too wide
 * - max-width (selected): Uncapped, allows button to use available space
 * - text max-width: Truncates long prompt names with ellipsis
 *
 * The button uses flex: 1 1 auto so it grows/shrinks within these bounds.
 */
const promptSelectorWidthCSS = css`
  --button-min-width: var(--ac-global-dimension-size-1800);
  --button-max-width-placeholder: var(--ac-global-dimension-size-2400);
  --text-max-width: 30ch;
`;

/**
 * Left dropdown: Searchable prompt selector.
 * Clicking a prompt selects it and automatically loads the latest version.
 */
export function PromptSelector({
  prompts,
  selectedPrompt,
  onSelectPrompt,
}: {
  prompts: PromptData[];
  selectedPrompt: PromptData | null;
  onSelectPrompt: (promptId: string) => void;
}) {
  const { contains } = useFilter({ sensitivity: "base" });

  const promptItems = useMemo(() => {
    return prompts.map((p) => ({
      id: p.id,
      name: p.name,
    }));
  }, [prompts]);

  const hasPrompts = prompts.length > 0;

  return (
    <MenuTrigger>
      <Button
        size="S"
        className="left-child"
        isDisabled={!hasPrompts}
        data-has-selection={selectedPrompt ? true : undefined}
        css={css(
          promptSelectorWidthCSS,
          css`
            justify-content: space-between;
            flex: 1 1 auto;
            min-width: var(--button-min-width);
            max-width: var(--button-max-width-placeholder);
            overflow: hidden;
            &[data-has-selection] {
              max-width: none;
            }
          `
        )}
      >
        <Truncate maxWidth="var(--text-max-width)" title={selectedPrompt?.name}>
          {selectedPrompt?.name ??
            (hasPrompts ? "Select prompt" : "No saved prompts")}
        </Truncate>
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer placement="bottom start" minHeight={0}>
        <Autocomplete filter={contains}>
          {promptItems.length >= SEARCH_THRESHOLD && (
            <MenuHeader>
              <SearchField
                aria-label="Search prompts"
                variant="quiet"
                autoFocus
              >
                <SearchIcon />
                <Input placeholder="Search prompts" />
              </SearchField>
            </MenuHeader>
          )}
          <Menu
            selectionMode="single"
            selectedKeys={selectedPrompt ? [selectedPrompt.id] : []}
            items={promptItems}
            renderEmptyState={() => (
              <View padding="size-400">
                <Text color="text-700">No prompts found</Text>
              </View>
            )}
            onAction={(key) => {
              onSelectPrompt(String(key));
            }}
          >
            {({ id, name }) => (
              <MenuItem id={id} textValue={name}>
                <Truncate maxLines={2} title={name}>
                  {name}
                </Truncate>
              </MenuItem>
            )}
          </Menu>
        </Autocomplete>
      </MenuContainer>
    </MenuTrigger>
  );
}

/**
 * Right dropdown: Version/tag selector with tabs.
 * Defaults to showing "latest", allows switching between versions and tags.
 */
export function PromptVersionSelector({
  prompt,
  selectedVersionInfo,
  selectedTagName,
  onSelectVersion,
  onSelectTag,
}: {
  prompt: PromptData | null;
  selectedVersionInfo: PromptVersion | null;
  selectedTagName: string | null | undefined;
  onSelectVersion: (versionId: string) => void;
  onSelectTag: (tagName: string) => void;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const { contains } = useFilter({ sensitivity: "base" });

  const versionItems = useMemo(() => {
    if (!prompt) return [];
    return prompt.versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      description: v.description,
      isLatest: v.isLatest,
    }));
  }, [prompt]);

  const tagItems = useMemo(() => {
    if (!prompt) return [];
    return prompt.versionTags.map((t) => ({
      id: t.name,
      name: t.name,
    }));
  }, [prompt]);

  // Determine what to show on the button
  const buttonContent = useMemo(() => {
    if (!prompt) {
      return <Text color="text-700">Version</Text>;
    }
    if (selectedTagName) {
      return <PromptBadge size="S" maxWidth="10ch" tag={selectedTagName} />;
    }
    if (selectedVersionInfo) {
      return (
        <PromptBadge
          size="S"
          versionId={selectedVersionInfo.id}
          isLatest={selectedVersionInfo.isLatest}
        />
      );
    }
    return <Text color="text-700">Version</Text>;
  }, [prompt, selectedTagName, selectedVersionInfo]);

  // Determine which tab should be default
  const defaultTab =
    selectedTagName && tagItems.length > 0 ? "tags" : "versions";

  return (
    <MenuTrigger>
      <Button
        size="S"
        className="right-child"
        css={css`
          justify-content: space-between;
          flex-shrink: 0;
        `}
      >
        {buttonContent}
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer placement="bottom start" minHeight={0}>
        <Tabs defaultSelectedKey={defaultTab}>
          <TabList>
            <Tab id="versions">Versions</Tab>
            <Tab id="tags" isDisabled={tagItems.length === 0}>
              {tagItems.length === 0 ? "No tags" : "Tags"}
            </Tab>
          </TabList>
          <LazyTabPanel id="versions">
            <Autocomplete filter={contains}>
              {versionItems.length >= SEARCH_THRESHOLD && (
                <MenuHeader>
                  <SearchField
                    aria-label="Search versions"
                    variant="quiet"
                    autoFocus
                  >
                    <SearchIcon />
                    <Input placeholder="Search versions" />
                  </SearchField>
                </MenuHeader>
              )}
              <Menu
                items={versionItems}
                renderEmptyState={() => (
                  <View padding="size-400">
                    <Text color="text-700">No versions found</Text>
                  </View>
                )}
                selectionMode="single"
                selectedKeys={
                  selectedVersionInfo ? [selectedVersionInfo.id] : []
                }
                onAction={(key) => {
                  onSelectVersion(String(key));
                }}
              >
                {({ id, createdAt, description, isLatest }) => (
                  <MenuItem
                    id={id}
                    textValue={`${id}\n${description ?? ""}\n${createdAt}`}
                  >
                    <Flex direction="column" gap="size-100">
                      <Truncate
                        maxLines={2}
                        title={description ?? "No change description"}
                      >
                        {description ? (
                          <Text>{description}</Text>
                        ) : (
                          <Text fontStyle="italic" color="text-300">
                            No change description
                          </Text>
                        )}
                      </Truncate>
                      <Flex alignItems="center" gap="size-100">
                        <IdTruncate id={id} textProps={{ size: "S" }} />
                        {isLatest && (
                          <Token
                            size="S"
                            color="var(--ac-global-color-grey-700)"
                          >
                            latest
                          </Token>
                        )}
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
              {tagItems.length >= SEARCH_THRESHOLD && (
                <MenuHeader>
                  <SearchField
                    aria-label="Search tags"
                    variant="quiet"
                    autoFocus
                  >
                    <SearchIcon />
                    <Input placeholder="Search tags" />
                  </SearchField>
                </MenuHeader>
              )}
              <Menu
                items={tagItems}
                renderEmptyState={() => (
                  <View padding="size-400">
                    <Text color="text-700">No tags found</Text>
                  </View>
                )}
                selectionMode="single"
                selectedKeys={selectedTagName ? [selectedTagName] : []}
                onAction={(key) => {
                  onSelectTag(String(key));
                }}
              >
                {({ name }) => (
                  <MenuItem id={name} textValue={name}>
                    <PromptBadge maxWidth="30ch" tag={name} />
                  </MenuItem>
                )}
              </Menu>
            </Autocomplete>
          </LazyTabPanel>
        </Tabs>
      </MenuContainer>
    </MenuTrigger>
  );
}

/**
 * Character based truncation for IDs.
 * Truncates from the start, preserving the last 6 characters (by default).
 * Adds underline as an affordance for hovering, to show the un-truncated ID.
 */
export function IdTruncate({
  id,
  length = 6,
  textProps,
  ellipsis,
}: {
  id: string;
  length?: number;
  textProps?: Partial<TextProps>;
  ellipsis?: boolean;
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
      {ellipsis ? <>&hellip;</> : ""}
      {truncatedValue}
    </Text>
  );
}
