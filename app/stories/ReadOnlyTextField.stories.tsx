import type { Meta, StoryFn } from "@storybook/react";

import { Flex } from "@phoenix/components";
import type { ReadOnlyTextFieldProps } from "@phoenix/components/core/field/ReadOnlyTextField";
import { ReadOnlyTextField } from "@phoenix/components/core/field/ReadOnlyTextField";

const meta: Meta<ReadOnlyTextFieldProps> = {
  title: "Core/Forms/Read-Only Text Field",
  component: ReadOnlyTextField,
  decorators: [
    (Story) => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    controls: { expanded: true },
  },
  argTypes: {
    size: {
      control: { type: "radio" },
      options: ["S", "M"],
    },
    copyable: {
      control: { type: "boolean" },
    },
  },
};

export default meta;

const Template: StoryFn<ReadOnlyTextFieldProps> = (args) => (
  <ReadOnlyTextField {...args} />
);

export const Default = Template.bind({});
Default.args = {
  label: "Project ID",
  value: "proj_abc123def456",
};

export const WithDescription = Template.bind({});
WithDescription.args = {
  label: "Endpoint URL",
  value: "https://api.example.com/v1/traces",
  description: "Use this URL to send trace data",
};

export const Copyable = Template.bind({});
Copyable.args = {
  label: "API Key",
  value: "sk-1234567890abcdef",
  copyable: true,
};

export const CopyableWithDescription = Template.bind({});
CopyableWithDescription.args = {
  label: "Project ID",
  value: "proj_abc123def456",
  description: "Click the copy button to copy to clipboard",
  copyable: true,
};

export const LongValue = Template.bind({});
LongValue.args = {
  label: "Trace ID",
  value:
    "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a-0123456789abcdef0123456789abcdef",
  copyable: true,
};

export const Sizes: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <ReadOnlyTextField
      size="S"
      label="Size S"
      value="small-field-value"
      copyable
    />
    <ReadOnlyTextField
      size="M"
      label="Size M (default)"
      value="medium-field-value"
      copyable
    />
  </Flex>
);

export const Gallery: StoryFn = () => (
  <Flex direction="column" gap="size-200">
    <ReadOnlyTextField label="Project Name" value="My Phoenix Project" />

    <ReadOnlyTextField
      label="Endpoint URL"
      value="https://api.example.com/v1/traces"
      description="Use this URL to send trace data"
    />

    <ReadOnlyTextField label="API Key" value="sk-1234567890abcdef" copyable />

    <ReadOnlyTextField
      label="Project ID"
      value="proj_abc123def456"
      description="Unique project identifier"
      copyable
    />

    <ReadOnlyTextField
      label="Trace ID"
      value="d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a"
      copyable
    />
  </Flex>
);
