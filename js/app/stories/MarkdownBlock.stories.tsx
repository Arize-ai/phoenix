import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";

import { Card, Flex, Text, View } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  ConnectedMarkdownModeSelect,
  MarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { PreferencesProvider } from "@phoenix/contexts";

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

const plainTextSample = [
  "# Literal text mode",
  "",
  "This same value should render as plain text when the toggle is set to Text.",
  '{"structured": true, "shouldStayPretty": true}',
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
  title: "Core/Content/MarkdownBlock",
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
  },
} satisfies Meta<typeof MarkdownBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  args: {
    children: complexMarkdown,
    mode: "markdown",
    margin: "none",
  },
  render: () => <MarkdownShowcase />,
};

export const MarkdownMode: Story = {
  args: {
    children: complexMarkdown,
    mode: "markdown",
    margin: "none",
  },
  render: (args) => (
    <Card title="Markdown mode" width="100%">
      <View padding="size-200">
        <MarkdownBlock {...args} />
      </View>
    </Card>
  ),
};

export const TextMode: Story = {
  args: {
    children: plainTextSample,
    mode: "text",
    margin: "none",
  },
  render: (args) => (
    <Flex direction="column" gap="size-100">
      <Text color="text-700">
        Text mode should preserve literal markdown markers and keep JSON-like
        payloads readable.
      </Text>
      <Card title="Text mode" width="100%">
        <View padding="size-200">
          <MarkdownBlock {...args} />
        </View>
      </Card>
    </Flex>
  ),
};
