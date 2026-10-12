import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import type { CopyFieldProps } from "@phoenix/components";
import { CopyField, CopyInput, Flex, Label, Text } from "@phoenix/components";

import { OptionGrid } from "../../utils/OptionGrid";

const meta: Meta = {
  title: "Design System/Forms/Copy Field",
  tags: ["updated", "unreviewed", "incomplete"],
  component: CopyField,

  parameters: {
    controls: { expanded: true },
    docs: {
      description: {
        component: `
A readonly text field with an embedded copy-to-clipboard button.
Use this for displaying values that users need to copy, such as URLs, API endpoints, or install commands.

## Usage

\`\`\`tsx
<CopyField value={BASE_URL}>
  <Label>Hostname</Label>
  <CopyInput />
</CopyField>
\`\`\`

The value goes on \`CopyField\`, not \`CopyInput\`: the field owns it.
        `,
      },
    },
  },
};

export default meta;

const Template: StoryFn<CopyFieldProps> = (args) => (
  <CopyField value="http://localhost:6006" {...args}>
    <Label>Hostname</Label>
    <CopyInput />
    <Text slot="description">Click the copy icon to copy to clipboard</Text>
  </CopyField>
);

export const Default = {
  tags: ["!dev"],
  render: Template,
  args: {},
};

export const Overflow: StoryFn = () => (
  <CopyField value="pip install arize-phoenix[evals,llama-index,openai] && phoenix serve --port 6006">
    <Label>Install Command</Label>
    <CopyInput />
    <Text slot="description">Copy and paste into your terminal</Text>
  </CopyField>
);

export const ExampleUsage: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="320px">
    <CopyField value="http://localhost:6006">
      <Label>Hostname</Label>
      <CopyInput />
    </CopyField>

    <CopyField value="20.16.0">
      <Label>Platform Version</Label>
      <CopyInput />
    </CopyField>

    <CopyField value="UHJvamVjdDox">
      <Label>Project ID</Label>
      <CopyInput />
    </CopyField>

    <CopyField value="http://localhost:6006/mcp">
      <Label>MCP Server URL</Label>
      <CopyInput />
    </CopyField>

    <CopyField value="pip install arize-phoenix">
      <Label>Install Command</Label>
      <CopyInput />
      <Text slot="description">Copy and paste into your terminal</Text>
    </CopyField>
  </Flex>
);

const SIZES: NonNullable<CopyFieldProps["size"]>[] = ["S", "M", "L"];

export const Sizes: StoryFn = () => (
  <OptionGrid
    rows={SIZES.map((size) => ({ label: size, code: true, size }))}
    cellWidth="320px"
    alignRows="start"
    renderCell={(row) => (
      <CopyField size={row.size} value="http://localhost:6006">
        <Label>Hostname</Label>
        <CopyInput />
      </CopyField>
    )}
  />
);

Overflow.tags = ["!dev"];
ExampleUsage.tags = ["!dev"];
Sizes.tags = ["!dev"];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj<CopyFieldProps> = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <CopyField value="https://phoenix.example.com">
      <Label>Hostname</Label>
      <CopyInput />
    </CopyField>
  ),
};
