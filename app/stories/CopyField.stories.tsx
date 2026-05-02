import type { Meta, StoryFn } from "@storybook/react";

import type { CopyFieldProps } from "@phoenix/components";
import { CopyField, CopyInput, Flex, Label, Text } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Forms/Copy Field",
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
<CopyField>
  <Label>API Endpoint</Label>
  <CopyInput defaultValue="https://api.example.com/v1" />
  <Text slot="description">Your API endpoint</Text>
</CopyField>
\`\`\`
        `,
      },
    },
  },
};

export default meta;

const Template: StoryFn<CopyFieldProps> = (args) => (
  <CopyField {...args}>
    <Label>API Endpoint</Label>
    <CopyInput defaultValue="https://api.example.com/v1" />
    <Text slot="description">Click the copy icon to copy to clipboard</Text>
  </CopyField>
);

export const Default = {
  render: Template,
  args: {},
};

export const WithLongValue: StoryFn = () => (
  <CopyField>
    <Label>Install Command</Label>
    <CopyInput defaultValue="pip install arize-phoenix[evals,llama-index,openai] && phoenix serve --port 6006" />
    <Text slot="description">Copy and paste into your terminal</Text>
  </CopyField>
);

export const Gallery: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CopyField>
      <Label>API Endpoint</Label>
      <CopyInput defaultValue="https://api.example.com/v1" />
      <Text slot="description">Click the copy icon to copy to clipboard</Text>
    </CopyField>

    <CopyField>
      <Label>Project ID</Label>
      <CopyInput defaultValue="proj_abc123def456" />
    </CopyField>

    <CopyField>
      <Label>Install Command</Label>
      <CopyInput defaultValue="pip install arize-phoenix[evals,llama-index,openai] && phoenix serve --port 6006" />
      <Text slot="description">Copy and paste into your terminal</Text>
    </CopyField>

    <CopyField size="S">
      <Label>Small Copy Field</Label>
      <CopyInput defaultValue="small-value" />
    </CopyField>

    <CopyField size="L">
      <Label>Large Copy Field</Label>
      <CopyInput defaultValue="large-value-example" />
    </CopyField>
  </Flex>
);

export const DifferentSizes: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CopyField size="S">
      <Label>Size S</Label>
      <CopyInput defaultValue="size-s-value" />
    </CopyField>
    <CopyField size="M">
      <Label>Size M (default)</Label>
      <CopyInput defaultValue="size-m-value" />
    </CopyField>
    <CopyField size="L">
      <Label>Size L</Label>
      <CopyInput defaultValue="size-l-value" />
    </CopyField>
  </Flex>
);
