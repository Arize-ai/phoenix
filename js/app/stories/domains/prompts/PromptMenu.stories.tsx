import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { userEvent, within } from "storybook/test";

import { CompositeField, Flex, Text } from "@phoenix/components";
import type {
  PromptData,
  PromptVersion,
} from "@phoenix/pages/playground/PromptMenu";
import {
  PromptSelector,
  PromptVersionSelector,
} from "@phoenix/pages/playground/PromptMenu";

/**
 * Container CSS that matches the PromptMenu component's wrapper.
 * This ensures stories render identically to the actual playground.
 */
const promptMenuContainerCSS = css`
  min-width: 0;
  flex: 1 1 auto;
  overflow: visible;
  display: flex;
`;

const meta: Meta = {
  title: "Domains/Prompts/Prompt Menu",
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    promptCount: {
      control: "select",
      options: [0, 2, 7, 12],
      description: "Number of prompts (search appears at 10+)",
    },
    versionCount: {
      control: "select",
      options: [1, 4, 7, 12],
      description: "Number of versions per prompt (search appears at 10+)",
    },
    tagCount: {
      control: "select",
      options: [0, 2, 7, 12],
      description: "Number of tags per prompt (search appears at 10+)",
    },
  },
  decorators: [
    (Story, { parameters }) => (
      <div style={{ width: "600px", ...parameters.containerStyle }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type StoryArgs = {
  promptCount: number;
  versionCount: number;
  tagCount: number;
};

// ============================================================================
// Mock Data Generators
// ============================================================================

const DEFAULT_PROMPT_NAMES = [
  "Customer Support Agent",
  "Code Review Assistant",
  "Data Analysis Helper",
  "Content Writer",
  "Translation Bot",
  "SQL Query Builder",
  "Bug Report Classifier",
  "Email Summarizer",
  "Meeting Notes Generator",
  "Product Description Writer",
  "API Documentation Helper",
  "Code Explainer",
];

const DEFAULT_TAG_NAMES = [
  "production",
  "staging",
  "development",
  "canary",
  "beta",
  "alpha",
  "v1",
  "v2",
  "stable",
  "experimental",
  "deprecated",
  "latest-stable",
];

const VERSION_DESCRIPTIONS = [
  "Latest improvements with better formatting",
  "Production-ready version",
  "Added few-shot examples",
  null,
  "Fixed edge cases in parsing",
  "Improved response quality",
  "Added streaming support",
  "Refactored prompt structure",
  "Enhanced error handling",
  "Optimized token usage",
  "Added context window management",
  "Performance improvements",
];

function generateVersions(count: number, tagNames: string[]): PromptVersion[] {
  const versions: PromptVersion[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date("2025-01-08T16:00:00Z");
    date.setHours(date.getHours() - i * 2);

    // Assign tags to some versions (first version gets first tag, etc.)
    const versionTags: { name: string }[] = [];
    if (i < tagNames.length) {
      versionTags.push({ name: tagNames[i] });
    }

    versions.push({
      id: `UHJvbXB0VmVyc2lvbjo${count - i}`,
      createdAt: date.toISOString(),
      description: VERSION_DESCRIPTIONS[i % VERSION_DESCRIPTIONS.length],
      isLatest: i === 0,
      tags: versionTags,
    });
  }
  return versions;
}

function generatePrompts(
  promptNames: string[],
  versionCount: number,
  tagNames: string[]
): PromptData[] {
  const tags = tagNames.map((name) => ({ name }));

  return promptNames.map((name, i) => ({
    id: `prompt-${i + 1}`,
    name,
    versionTags: tags,
    versions: generateVersions(versionCount, tagNames),
  }));
}

// ============================================================================
// Shared types and components
// ============================================================================

type SelectionState = {
  selectedPromptIndex: number | null;
  versionType: "latest" | "tag" | "specificVersion";
  selectedTagName: string | null;
  selectedVersionIndex: number;
};

type PresetConfig = {
  promptNames: string[];
  tagNames: string[];
  versionCount: number;
  initialSelectedPromptIndex: number | null;
  initialVersionType: "latest" | "tag" | "specificVersion";
  initialSelectedTagName?: string;
  initialSelectedVersionIndex?: number;
};

function PresetRender({
  promptNames,
  tagNames,
  versionCount,
  initialSelectedPromptIndex,
  initialVersionType,
  initialSelectedTagName,
  initialSelectedVersionIndex = 1,
}: PresetConfig) {
  const [selection, setSelection] = React.useState<SelectionState>({
    selectedPromptIndex: initialSelectedPromptIndex,
    versionType: initialVersionType,
    selectedTagName: initialSelectedTagName ?? null,
    selectedVersionIndex: initialSelectedVersionIndex,
  });

  // Memoize prompts to maintain stable references - prevents react-aria
  // from re-initializing collections on every render
  const prompts = React.useMemo(
    () => generatePrompts(promptNames, versionCount, tagNames),
    [promptNames, versionCount, tagNames]
  );

  const selectedPrompt =
    selection.selectedPromptIndex !== null && selection.selectedPromptIndex >= 0
      ? (prompts[selection.selectedPromptIndex] ?? null)
      : null;

  const selectedVersionInfo = (() => {
    if (!selectedPrompt) return null;
    if (selection.versionType === "latest") {
      return selectedPrompt.versions.find((v) => v.isLatest) ?? null;
    }
    if (selection.versionType === "specificVersion") {
      return selectedPrompt.versions[selection.selectedVersionIndex] ?? null;
    }
    if (selection.versionType === "tag" && selection.selectedTagName) {
      return (
        selectedPrompt.versions.find((v) =>
          v.tags.some((t) => t.name === selection.selectedTagName)
        ) ?? null
      );
    }
    return null;
  })();

  const selectedTagName =
    selection.versionType === "tag" ? selection.selectedTagName : null;

  const handleSelectPrompt = (promptId: string) => {
    const index = prompts.findIndex((p) => p.id === promptId);
    setSelection({
      selectedPromptIndex: index >= 0 ? index : null,
      versionType: "latest",
      selectedTagName: null,
      selectedVersionIndex: 1,
    });
  };

  const handleSelectVersion = (versionId: string) => {
    if (!selectedPrompt) return;
    const versionIndex = selectedPrompt.versions.findIndex(
      (v) => v.id === versionId
    );
    const version = selectedPrompt.versions[versionIndex];
    if (version?.isLatest) {
      setSelection((s) => ({
        ...s,
        versionType: "latest",
        selectedTagName: null,
      }));
    } else {
      setSelection((s) => ({
        ...s,
        versionType: "specificVersion",
        selectedVersionIndex: versionIndex,
        selectedTagName: null,
      }));
    }
  };

  const handleSelectTag = (tagName: string) => {
    setSelection((s) => ({
      ...s,
      versionType: "tag",
      selectedTagName: tagName,
    }));
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
            selectedTagName={selectedTagName}
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
        selectedPrompt={null}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
}

// ============================================================================
// Interactive Playground Story
// ============================================================================

function PlaygroundRender(args: StoryArgs) {
  const [selection, setSelection] = React.useState<SelectionState>({
    selectedPromptIndex: null,
    versionType: "latest",
    selectedTagName: null,
    selectedVersionIndex: 1,
  });

  // Memoize prompts to maintain stable references - prevents react-aria
  // from re-initializing collections on every render
  const prompts = React.useMemo(() => {
    const promptNames = DEFAULT_PROMPT_NAMES.slice(0, args.promptCount);
    const tagNames = DEFAULT_TAG_NAMES.slice(0, args.tagCount);
    return generatePrompts(promptNames, args.versionCount, tagNames);
  }, [args.promptCount, args.versionCount, args.tagCount]);

  // Reset selection if prompt count changes and current selection is out of range
  React.useEffect(() => {
    if (
      selection.selectedPromptIndex !== null &&
      selection.selectedPromptIndex >= prompts.length
    ) {
      // eslint-disable-next-line react/set-state-in-effect
      setSelection((s) => ({ ...s, selectedPromptIndex: null }));
    }
  }, [prompts.length, selection.selectedPromptIndex]);

  const selectedPrompt =
    selection.selectedPromptIndex !== null && selection.selectedPromptIndex >= 0
      ? (prompts[selection.selectedPromptIndex] ?? null)
      : null;

  const selectedVersionInfo = (() => {
    if (!selectedPrompt) return null;
    if (selection.versionType === "latest") {
      return selectedPrompt.versions.find((v) => v.isLatest) ?? null;
    }
    if (selection.versionType === "specificVersion") {
      return selectedPrompt.versions[selection.selectedVersionIndex] ?? null;
    }
    if (selection.versionType === "tag" && selection.selectedTagName) {
      return (
        selectedPrompt.versions.find((v) =>
          v.tags.some((t) => t.name === selection.selectedTagName)
        ) ?? null
      );
    }
    return null;
  })();

  const selectedTagName =
    selection.versionType === "tag" ? selection.selectedTagName : null;

  const handleSelectPrompt = (promptId: string) => {
    const index = prompts.findIndex((p) => p.id === promptId);
    setSelection({
      selectedPromptIndex: index >= 0 ? index : null,
      versionType: "latest",
      selectedTagName: null,
      selectedVersionIndex: 1,
    });
  };

  const handleSelectVersion = (versionId: string) => {
    if (!selectedPrompt) return;
    const versionIndex = selectedPrompt.versions.findIndex(
      (v) => v.id === versionId
    );
    const version = selectedPrompt.versions[versionIndex];
    if (version?.isLatest) {
      setSelection((s) => ({
        ...s,
        versionType: "latest",
        selectedTagName: null,
      }));
    } else {
      setSelection((s) => ({
        ...s,
        versionType: "specificVersion",
        selectedVersionIndex: versionIndex,
        selectedTagName: null,
      }));
    }
  };

  const handleSelectTag = (tagName: string) => {
    setSelection((s) => ({
      ...s,
      versionType: "tag",
      selectedTagName: tagName,
    }));
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
            selectedTagName={selectedTagName}
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
        selectedPrompt={null}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
}

export const Playground: StoryObj<StoryArgs> = {
  args: {
    promptCount: 7,
    versionCount: 4,
    tagCount: 7,
  },
  render: PlaygroundRender,
};

Playground.storyName = "Interactive Playground";

// ============================================================================
// Preset Stories - Fixed configurations as quick reference
// ============================================================================

type PresetStory = StoryObj<PresetConfig>;

const presetParameters = {
  controls: { disable: true },
};

/**
 * One labeled item per preset, each with its own selection state.
 */
function PresetStack({
  items,
}: {
  items: { label: string; config: PresetConfig }[];
}) {
  return (
    <Flex direction="column" gap="size-300">
      {items.map(({ label, config }) => (
        <Flex key={label} direction="column" gap="size-100">
          <Text size="S" color="text-700">
            {label}
          </Text>
          <PresetRender {...config} />
        </Flex>
      ))}
    </Flex>
  );
}

/**
 * Tag "production" sits on the latest version, so this shows that an
 * explicitly selected tag is displayed instead of "latest".
 */
const loadedWithTag: PresetConfig = {
  promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
  tagNames: ["production", "staging"],
  versionCount: 2,
  initialSelectedPromptIndex: 0,
  initialVersionType: "tag",
  initialSelectedTagName: "production",
};

/**
 * What the menu shows for each data and selection state, in lifecycle order:
 *
 * - **No prompts** — the prompt button is disabled and reads "No saved
 *   prompts".
 * - **Prompts available, none selected** — the "Select a prompt" placeholder,
 *   with the button's width capped.
 * - **Loaded with latest** — the version button shows the "latest" token.
 * - **Loaded with a specific version** — a non-latest version shows its
 *   truncated ID instead of "latest".
 * - **Loaded with a tag** — an explicitly selected tag is shown by name, even
 *   when the tagged version is also the latest.
 */
export const ContentTypes: PresetStory = {
  name: "Content Types",
  parameters: presetParameters,
  render: () => (
    <PresetStack
      items={[
        {
          label: "No prompts",
          config: {
            promptNames: [],
            tagNames: [],
            versionCount: 0,
            initialSelectedPromptIndex: null,
            initialVersionType: "latest",
          },
        },
        {
          label: "Prompts available, none selected",
          config: {
            promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
            tagNames: [],
            versionCount: 2,
            initialSelectedPromptIndex: null,
            initialVersionType: "latest",
          },
        },
        {
          label: "Loaded with latest version",
          config: {
            promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
            tagNames: [],
            versionCount: 2,
            initialSelectedPromptIndex: 0,
            initialVersionType: "latest",
          },
        },
        {
          label: "Loaded with a specific (non-latest) version",
          config: {
            promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
            tagNames: [],
            versionCount: 2,
            initialSelectedPromptIndex: 0,
            initialVersionType: "specificVersion",
            initialSelectedVersionIndex: 1,
          },
        },
        {
          label: "Loaded with a tag (on the latest version)",
          config: loadedWithTag,
        },
      ]}
    />
  ),
};

/**
 * Shows prompt search field (P12V1T2).
 * With 12+ prompts, the search field appears in the prompt menu.
 */
export const PromptSearchEnabled: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 12),
    tagNames: ["production", "staging"],
    versionCount: 1,
    initialSelectedPromptIndex: 0,
    initialVersionType: "latest",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the prompt selector to open menu and show search
    const promptButton = canvas.getByRole("button", {
      name: /Customer Support Agent/i,
    });
    await userEvent.click(promptButton);
  },
};

/**
 * Shows version search field (P7V12T2).
 * With 12+ versions, the search field appears in the versions tab.
 */
export const VersionSearchEnabled: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
    tagNames: ["production", "staging"],
    versionCount: 12,
    initialSelectedPromptIndex: 0,
    initialVersionType: "latest",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the version selector to open menu and show search
    const versionButton = canvas.getByRole("button", { name: /latest/i });
    await userEvent.click(versionButton);
  },
};

/**
 * Shows tag search field (P7V2T12).
 * With 12+ tags, the search field appears in the tags tab.
 */
export const TagSearchEnabled: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
    tagNames: DEFAULT_TAG_NAMES.slice(0, 12),
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "tag",
    initialSelectedTagName: "production", // First tag
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the version selector to open menu (shows Tags tab by default since tag is selected)
    const versionButton = canvas.getByRole("button", { name: /production/i });
    await userEvent.click(versionButton);
  },
};

/**
 * Demonstrates minimum width with short prompt names (P2V2T2).
 * Single-word prompt names to show the min-width constraint.
 */
export const MinPromptWidth: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: ["Bot", "AI"],
    tagNames: ["v1", "v2"],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "latest",
  },
};

/**
 * Demonstrates overflow with very long prompt names (P2V2T2).
 * Tests how the component handles extremely long generated strings.
 */
export const MaxPromptWidth: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: [
      "enterprise-customer-support-chatbot-v2-with-enhanced-rag-pipeline-and-multi-turn-conversation-memory-optimized-for-high-throughput-production-workloads",
      "xK9mN2pL5qR8vW3yZ7aB4cD6eF1gH0iJ",
    ],
    tagNames: ["production", "staging"],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "latest",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open prompt menu to show the long names. Target it by name: the
    // version button is also rendered once a prompt is selected.
    const promptButton = canvas.getByRole("button", {
      name: /enterprise-customer-support-chatbot/,
    });
    await userEvent.click(promptButton);
  },
};

/**
 * Demonstrates overflow with very long tag names (P2V2T2).
 * One tag has spaces (tests word-wrap), one is a continuous string (tests overflow).
 */
export const MaxTagWidth: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 2),
    tagNames: [
      "production release candidate for enterprise customers with extended support",
      "xK9mN2pL5qR8vW3yZ7aB4cD6eF1gH0iJkLmNoPqRsTuVwXyZ",
    ],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "tag",
    initialSelectedTagName:
      "production release candidate for enterprise customers with extended support",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Open version menu and switch to tags tab
    const versionButton = canvas.getByRole("button", { name: /production/i });
    await userEvent.click(versionButton);
    const tagsTab = canvas.getByRole("tab", { name: /Tags/i });
    await userEvent.click(tagsTab);
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: PresetStory = {
  render: (args) => <PresetRender {...args} />,
  args: loadedWithTag,
  tags: ["!dev", "!autodocs"],
  parameters: {
    ...presetParameters,
    // Pinned to the top of the frame so the menu opens down into it.
    containerStyle: { width: "288px", alignSelf: "flex-start" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // There is no open prop; open the prompt menu as a user would.
    await userEvent.click(
      canvas.getByRole("button", { name: /Customer Support Agent/i })
    );
  },
};
