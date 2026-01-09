import React from "react";
import { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/test";
import { css } from "@emotion/react";

import { CompositeField } from "@phoenix/components";
import {
  PromptData,
  PromptSelector,
  PromptVersion,
  PromptVersionSelector,
} from "@phoenix/pages/playground/PromptMenu";

const meta: Meta = {
  title: "PromptMenu",
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
// Container styling - matches the real PromptMenu container
// ============================================================================

const containerCSS = css`
  display: inline-grid;
  min-width: 200px;
`;

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

  const prompts = generatePrompts(promptNames, versionCount, tagNames);

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

  const hasSelection = selectedPrompt !== null;

  return (
    <div css={containerCSS}>
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
            selectedTagName={selectedTagName}
            onSelectVersion={handleSelectVersion}
            onSelectTag={handleSelectTag}
          />
        </CompositeField>
      ) : (
        <PromptSelector
          prompts={prompts}
          selectedPrompt={null}
          onSelectPrompt={handleSelectPrompt}
        />
      )}
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

  const promptNames = DEFAULT_PROMPT_NAMES.slice(0, args.promptCount);
  const tagNames = DEFAULT_TAG_NAMES.slice(0, args.tagCount);
  const prompts = generatePrompts(promptNames, args.versionCount, tagNames);

  // Reset selection if prompt count changes and current selection is out of range
  React.useEffect(() => {
    if (
      selection.selectedPromptIndex !== null &&
      selection.selectedPromptIndex >= prompts.length
    ) {
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

  const hasSelection = selectedPrompt !== null;

  return (
    <div css={containerCSS}>
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
            selectedTagName={selectedTagName}
            onSelectVersion={handleSelectVersion}
            onSelectTag={handleSelectTag}
          />
        </CompositeField>
      ) : (
        <PromptSelector
          prompts={prompts}
          selectedPrompt={null}
          onSelectPrompt={handleSelectPrompt}
        />
      )}
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
 * Empty state when no prompts exist (P0V0T0).
 * Button is disabled and shows "No saved prompts".
 */
export const NoPrompts: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: [],
    tagNames: [],
    versionCount: 0,
    initialSelectedPromptIndex: null,
    initialVersionType: "latest",
  },
};

/**
 * Prompt loaded with latest version selected (P7V2T0).
 * No tags on this prompt.
 */
export const LoadedWithLatest: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
    tagNames: [],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "latest",
  },
};

/**
 * Prompt loaded with a specific non-latest version (P7V2T0).
 * Shows version ID instead of "latest" tag.
 */
export const LoadedWithVersion: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
    tagNames: [],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "specificVersion",
    initialSelectedVersionIndex: 1, // second version (not latest)
  },
};

/**
 * Prompt loaded with a tag selected (P7V2T2).
 * Shows the tag name even though it's also the latest version.
 * This is notable behavior: when a tag is explicitly selected, we show the tag,
 * not "latest", even if the tagged version happens to be the latest.
 */
export const LoadedWithTag: PresetStory = {
  parameters: presetParameters,
  render: (args) => <PresetRender {...args} />,
  args: {
    promptNames: DEFAULT_PROMPT_NAMES.slice(0, 7),
    tagNames: ["production", "staging"],
    versionCount: 2,
    initialSelectedPromptIndex: 0,
    initialVersionType: "tag",
    initialSelectedTagName: "production", // This is on the latest version
  },
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
    // Open prompt menu to show the long names
    const promptButton = canvas.getByRole("button");
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
