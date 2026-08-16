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
  <CopyInput defaultValue="https://phoenix.example.com" />
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
  <CopyField value="https://phoenix.example.com" {...args}>
    <Label>Hostname</Label>
    <CopyInput />
    <Text slot="description">Click the copy icon to copy to clipboard</Text>
  </CopyField>
);

export const Default = {
  render: Template,
  args: {},
};

export const WithLongValue: StoryFn = () => (
  <CopyField value="pip install arize-phoenix[evals,llama-index,openai] && phoenix serve --port 6006">
    <Label>Install Command</Label>
    <CopyInput />
    <Text slot="description">Copy and paste into your terminal</Text>
  </CopyField>
);

export const Gallery: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CopyField value="https://phoenix.example.com">
      <Label>Hostname</Label>
      <CopyInput />
      <Text slot="description">Click the copy icon to copy to clipboard</Text>
    </CopyField>

    <CopyField value="UHJvamVjdDoxMjM0NTY3ODkw">
      <Label>Project ID</Label>
      <CopyInput />
    </CopyField>

    <CopyField value="pip install arize-phoenix[evals,llama-index,openai] && phoenix serve --port 6006">
      <Label>Install Command</Label>
      <CopyInput />
      <Text slot="description">Copy and paste into your terminal</Text>
    </CopyField>

    <CopyField size="S" value="11.12.0">
      <Label>Platform Version</Label>
      <CopyInput />
    </CopyField>

    <CopyField
      size="L"
      value="OTLPSpanExporter(endpoint=PHOENIX_COLLECTOR_ENDPOINT)"
    >
      <Label>Exporter Configuration</Label>
      <CopyInput />
    </CopyField>
  </Flex>
);

export const DifferentSizes: StoryFn = () => (
  <Flex direction="column" gap="size-200" width="600px">
    <CopyField size="S" value="11.12.0">
      <Label>Size S</Label>
      <CopyInput />
    </CopyField>
    <CopyField size="M" value="https://phoenix.example.com">
      <Label>Size M (default)</Label>
      <CopyInput />
    </CopyField>
    <CopyField
      size="L"
      value="OTLPSpanExporter(endpoint=PHOENIX_COLLECTOR_ENDPOINT)"
    >
      <Label>Size L</Label>
      <CopyInput />
    </CopyField>
  </Flex>
);
