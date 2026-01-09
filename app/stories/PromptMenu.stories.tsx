import { Meta, StoryObj } from "@storybook/react";
import { useArgs } from "storybook/internal/preview-api";
import { css } from "@emotion/react";

import { CompositeField, Flex, Text, View } from "@phoenix/components";
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
    selectedPromptIndex: {
      control: "select",
      options: [-1, 0, 1, 2],
      mapping: { "-1": null, "0": 0, "1": 1, "2": 2 },
      description: "Index of selected prompt (-1 = none)",
    },
    versionType: {
      control: "radio",
      options: ["latest", "tag", "specificVersion"],
      description: "Type of version selection",
      if: { arg: "selectedPromptIndex", neq: -1 },
    },
    selectedTagName: {
      control: "select",
      options: ["production", "staging", "development"],
      description: "Selected tag name",
      if: { arg: "versionType", eq: "tag" },
    },
    selectedVersionIndex: {
      control: "select",
      options: [0, 1, 2, 3],
      description: "Index of selected version",
      if: { arg: "versionType", eq: "specificVersion" },
    },
    promptCount: {
      control: "select",
      options: [0, 2, 7, 12],
      description: "Number of prompts (search appears at 12+)",
    },
    versionCount: {
      control: "select",
      options: [1, 4, 7, 12],
      description: "Number of versions per prompt (search appears at 12+)",
      if: { arg: "selectedPromptIndex", neq: -1 },
    },
    tagCount: {
      control: "select",
      options: [0, 2, 7, 12],
      description: "Number of tags per prompt (search appears at 12+)",
      if: { arg: "selectedPromptIndex", neq: -1 },
    },
  },
};

export default meta;

type StoryArgs = {
  selectedPromptIndex: number | null;
  versionType: "latest" | "tag" | "specificVersion";
  selectedTagName: string;
  selectedVersionIndex: number;
  promptCount: number;
  versionCount: number;
  tagCount: number;
};

// ============================================================================
// Mock Data Generators - produce data matching the real PromptData/PromptVersion types
// ============================================================================

const PROMPT_NAMES = [
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

const TAG_NAMES = [
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
  null, // some versions have no description
  "Fixed edge cases in parsing",
  "Improved response quality",
  "Added streaming support",
  "Refactored prompt structure",
  "Enhanced error handling",
  "Optimized token usage",
  "Added context window management",
  "Performance improvements",
];

function generateVersions(count: number, tagCount: number): PromptVersion[] {
  const versions: PromptVersion[] = [];
  const tags = TAG_NAMES.slice(0, tagCount);

  for (let i = 0; i < count; i++) {
    const date = new Date("2025-01-08T16:00:00Z");
    date.setHours(date.getHours() - i * 2);

    // Assign tags to some versions (first version gets first tag, etc.)
    const versionTags: { name: string }[] = [];
    if (i < tags.length) {
      versionTags.push({ name: tags[i] });
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
  promptCount: number,
  versionCount: number,
  tagCount: number
): PromptData[] {
  const tags = TAG_NAMES.slice(0, tagCount).map((name) => ({ name }));

  return PROMPT_NAMES.slice(0, promptCount).map((name, i) => ({
    id: `prompt-${i + 1}`,
    name,
    versionTags: tags,
    versions: generateVersions(versionCount, tagCount),
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
// Story
// ============================================================================

/** Minimum items before search field appears */
const SEARCH_THRESHOLD = 12;

export const Playground: StoryObj<StoryArgs> = {
  args: {
    selectedPromptIndex: null,
    versionType: "latest",
    selectedTagName: "production",
    selectedVersionIndex: 1,
    promptCount: 7,
    versionCount: 4,
    tagCount: 7,
  },
  render: function Render(args) {
    const [, updateArgs] = useArgs<StoryArgs>();

    // Generate mock data based on controls
    const prompts = generatePrompts(
      args.promptCount,
      args.versionCount,
      args.tagCount
    );

    // Derive selected prompt from index
    const selectedPrompt =
      args.selectedPromptIndex !== null && args.selectedPromptIndex >= 0
        ? (prompts[args.selectedPromptIndex] ?? null)
        : null;

    // Derive selected version info
    const selectedVersionInfo = (() => {
      if (!selectedPrompt) return null;
      if (args.versionType === "latest") {
        return selectedPrompt.versions.find((v) => v.isLatest) ?? null;
      }
      if (args.versionType === "specificVersion") {
        return selectedPrompt.versions[args.selectedVersionIndex] ?? null;
      }
      // For tag selection, find version with that tag
      if (args.versionType === "tag") {
        return (
          selectedPrompt.versions.find((v) =>
            v.tags.some((t) => t.name === args.selectedTagName)
          ) ?? null
        );
      }
      return null;
    })();

    // Derive selected tag name
    const selectedTagName =
      args.versionType === "tag" ? args.selectedTagName : null;

    // Handlers that update Storybook args (two-way binding)
    const handleSelectPrompt = (promptId: string) => {
      const index = prompts.findIndex((p) => p.id === promptId);
      updateArgs({
        selectedPromptIndex: index >= 0 ? index : null,
        versionType: "latest",
      });
    };

    const handleSelectVersion = (versionId: string) => {
      if (!selectedPrompt) return;
      const versionIndex = selectedPrompt.versions.findIndex(
        (v) => v.id === versionId
      );
      const version = selectedPrompt.versions[versionIndex];
      if (version?.isLatest) {
        updateArgs({ versionType: "latest" });
      } else {
        updateArgs({
          versionType: "specificVersion",
          selectedVersionIndex: versionIndex,
        });
      }
    };

    const handleSelectTag = (tagName: string) => {
      updateArgs({ versionType: "tag", selectedTagName: tagName });
    };

    // Conditional rendering matches real PromptMenu
    const hasSelection = selectedPrompt !== null;

    return (
      <Flex direction="column" gap="size-300" alignItems="start">
        {/* The actual component under test */}
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

        {/* Debug info panel */}
        <View
          padding="size-200"
          borderWidth="thin"
          borderColor="grey-300"
          borderRadius="medium"
          minWidth={300}
        >
          <Flex direction="column" gap="size-50">
            <Text weight="heavy" size="S">
              Current State:
            </Text>
            <Text size="XS" color="text-700">
              Prompt: {selectedPrompt?.name ?? "(none)"}
            </Text>
            {hasSelection && (
              <>
                <Text size="XS" color="text-700">
                  Version Type: {args.versionType}
                </Text>
                {args.versionType === "tag" && (
                  <Text size="XS" color="text-700">
                    Tag: {args.selectedTagName}
                  </Text>
                )}
                {args.versionType === "specificVersion" && (
                  <Text size="XS" color="text-700">
                    Version: {selectedVersionInfo?.id ?? "unknown"}
                  </Text>
                )}
              </>
            )}
            <Text
              size="XS"
              color="text-300"
              css={css`
                margin-top: var(--ac-global-dimension-size-100);
              `}
            >
              Prompts: {args.promptCount}
              {args.promptCount >= SEARCH_THRESHOLD && " (search visible)"}
            </Text>
            {hasSelection && (
              <>
                <Text size="XS" color="text-300">
                  Versions: {args.versionCount}
                  {args.versionCount >= SEARCH_THRESHOLD && " (search visible)"}
                </Text>
                <Text size="XS" color="text-300">
                  Tags: {args.tagCount}
                  {args.tagCount >= SEARCH_THRESHOLD && " (search visible)"}
                </Text>
              </>
            )}
          </Flex>
        </View>
      </Flex>
    );
  },
};

Playground.storyName = "Interactive Playground";
