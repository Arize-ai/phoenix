import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Card, View } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeSelect,
  MarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { PreferencesProvider } from "@phoenix/contexts";

import { OptionGrid } from "../../utils/OptionGrid";

const containerCSS = css`
  width: min(960px, 100%);
`;

const complexMarkdown = [
  "# Phoenix Markdown QA",
  "",
  "Use this story to validate the shared markdown abstraction while we migrate renderers.",
  "",
  "## Mixed content",
  "",
  "- Supports unordered lists",
  "- Preserves **bold text**, _emphasis_, and ~~strikethrough~~",
  "- Keeps inline code like `pnpm storybook`",
  "",
  "1. Ordered lists should keep numbering",
  "2. Links should inherit app styling: [Phoenix docs](https://arize.com/docs/phoenix)",
  "3. Task lists and tables should stay readable",
  "",
  "> Blockquotes should feel visually distinct without overpowering the body copy.",
  "",
  "### Task checklist",
  "",
  "- [x] Render GitHub-flavored markdown",
  "- [x] Keep line wrapping readable",
  "- [ ] Verify tables, code fences, and quotes",
  "",
  "### Table",
  "",
  "| Surface | Content |",
  "| --- | --- |",
  "| Trace details | Long prompts, tool output, retrieved docs |",
  "| Playground | Model responses and tool call summaries |",
  "| Experiments | Extracted assistant output |",
  "",
  "### JSON fence",
  "",
  "```json",
  "{",
  '  "project": "phoenix",',
  '  "renderer": "streamdown",',
  '  "preserveToggle": true,',
  '  "checks": ["links", "lists", "tables", "code"]',
  "}",
  "```",
  "",
  "### Python fence",
  "",
  "```python",
  "def summarize(status: str) -> str:",
  '    return f"migration status: {status}"',
  "```",
].join("\n");

function MarkdownShowcase() {
  return (
    <PreferencesProvider markdownDisplayMode="markdown">
      <MarkdownDisplayProvider>
        <Card
          title="Markdown Abstraction"
          extra={<ConnectedMarkdownModeSelect />}
          width="100%"
        >
          <View padding="size-200">
            <ConnectedMarkdownBlock>{complexMarkdown}</ConnectedMarkdownBlock>
          </View>
        </Card>
      </MarkdownDisplayProvider>
    </PreferencesProvider>
  );
}

const meta = {
  title: "Design System/Typography/Markdown Block",
  tags: ["updated", "incomplete", "unreviewed"],
  component: MarkdownBlock,
  decorators: [
    (Story) => (
      <div css={containerCSS}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
} satisfies Meta<typeof MarkdownBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

const modes = [
  { label: "Raw text", mode: "text" },
  { label: "Markdown", mode: "markdown" },
] as const;

export const RawTextMode: Story = {
  tags: ["!dev"],
  args: {
    children: complexMarkdown,
    mode: "text",
    margin: "none",
  },
  parameters: { themeLayout: "column" },
  render: () => (
    <OptionGrid
      columns={modes}
      cellWidth="minmax(0, 1fr)"
      alignRows="start"
      renderCell={(_row, column) => (
        <MarkdownBlock mode={column?.mode ?? "text"} margin="none">
          {complexMarkdown}
        </MarkdownBlock>
      )}
    />
  ),
};

export const Interactive: Story = {
  tags: ["!dev"],
  args: {
    children: complexMarkdown,
    mode: "markdown",
    margin: "none",
  },
  render: () => <MarkdownShowcase />,
};

/** An excerpt of `complexMarkdown` small enough for the Overview card. */
const thumbnailMarkdown = [
  "## Mixed content",
  "",
  "- Supports unordered lists",
  "- Preserves **bold text**, _emphasis_, and ~~strikethrough~~",
  "- Keeps inline code like `pnpm storybook`",
].join("\n");

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  args: {
    children: thumbnailMarkdown,
    mode: "markdown",
    margin: "none",
  },
};
