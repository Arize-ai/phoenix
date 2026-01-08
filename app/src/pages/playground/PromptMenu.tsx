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
  SearchIcon,
  SelectChevronUpDownIcon,
  Tab,
  TabList,
  Tabs,
  Text,
  TextProps,
  Token,
  View,
} from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";
import { useTimeFormatters } from "@phoenix/hooks";
import { PromptMenuQuery } from "@phoenix/pages/playground/__generated__/PromptMenuQuery.graphql";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

type PromptVersion = {
  id: string;
  createdAt: string;
  description: string | null;
  isLatest: boolean;
  tags: readonly { name: string }[];
};

type PromptData = {
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
  }, [data.prompts.edges]);

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

    // Find the latest version
    const latestVersion = prompt.versions.find((v) => v.isLatest);
    if (latestVersion) {
      onChange({
        promptId: newPromptId,
        promptVersionId: latestVersion.id,
        promptTagName: null,
      });
    }
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

  const hasSelection = selectedPrompt !== null;

  return (
    <div
      css={css`
        display: inline-grid;
        min-width: 200px;
      `}
    >
      {hasSelection ? (
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
      ) : (
        <PromptSelector
          prompts={prompts}
          selectedPrompt={selectedPrompt}
          onSelectPrompt={handleSelectPrompt}
        />
      )}
    </div>
  );
};

/**
 * Left dropdown: Searchable prompt selector.
 * Clicking a prompt selects it and automatically loads the latest version.
 */
function PromptSelector({
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

  return (
    <MenuTrigger>
      <Button
        size="S"
        className="left-child"
        css={css`
          justify-content: space-between;
        `}
      >
        {selectedPrompt ? (
          <Text>{selectedPrompt.name}</Text>
        ) : (
          <Text color="text-700">Select prompt</Text>
        )}
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer>
        <Autocomplete filter={contains}>
          <MenuHeader>
            <SearchField aria-label="Search prompts" autoFocus>
              <SearchIcon />
              <Input placeholder="Search prompts" />
            </SearchField>
          </MenuHeader>
          <Menu
            selectionMode="single"
            selectedKeys={selectedPrompt ? [selectedPrompt.id] : []}
            items={promptItems}
            renderEmptyState={() => (
              <View padding="size-200">
                <Text color="text-700">No prompts found</Text>
              </View>
            )}
            onAction={(key) => {
              onSelectPrompt(String(key));
            }}
          >
            {({ id, name }) => (
              <MenuItem id={id} textValue={name}>
                {name}
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
function PromptVersionSelector({
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
      return <TagVersionLabel>{selectedTagName}</TagVersionLabel>;
    }
    if (selectedVersionInfo) {
      return (
        <PromptVersionLabel
          id={selectedVersionInfo.id}
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
        `}
      >
        {buttonContent}
        <SelectChevronUpDownIcon />
      </Button>
      <MenuContainer>
        <Tabs defaultSelectedKey={defaultTab}>
          <TabList>
            <Tab id="versions">Versions</Tab>
            <Tab id="tags">Tags</Tab>
          </TabList>
          <LazyTabPanel id="versions">
            <Autocomplete filter={contains}>
              <MenuHeader>
                <SearchField aria-label="Search versions" autoFocus>
                  <SearchIcon />
                  <Input placeholder="Search versions" />
                </SearchField>
              </MenuHeader>
              <Menu
                items={versionItems}
                renderEmptyState={() => (
                  <View padding="size-200">
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
              <MenuHeader>
                <SearchField aria-label="Search tags" autoFocus>
                  <SearchIcon />
                  <Input placeholder="Search tags" />
                </SearchField>
              </MenuHeader>
              <Menu
                items={tagItems}
                renderEmptyState={() => (
                  <View padding="size-200">
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
                    <TagVersionLabel>{name}</TagVersionLabel>
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
 * Renders a label for a prompt version. If the version is the latest, it shows "latest" as a tag.
 * Otherwise, it shows the ID truncated to 6 characters.
 */
function PromptVersionLabel({
  id,
  isLatest,
}: {
  id: string;
  isLatest: boolean;
}) {
  if (isLatest) {
    return (
      <Token size="S" color="var(--ac-global-color-blue-1000)">
        latest
      </Token>
    );
  }
  return <IdTruncate id={id} />;
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
