import type { Meta, StoryObj } from "@storybook/react";

import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";

/**
 * A select component that provides a dropdown selection interface.
 * It supports different sizes, is fully accessible, and follows the design system's styling.
 */
const meta = {
  title: "Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["S", "M"],
      description: "The size of the select component",
      defaultValue: "M",
    },
    isDisabled: {
      control: "boolean",
      description: "Whether the select is disabled",
      defaultValue: false,
    },
    isRequired: {
      control: "boolean",
      description: "Whether the select is required",
      defaultValue: false,
    },
    isInvalid: {
      control: "boolean",
      description: "Whether the select is in an invalid state",
      defaultValue: false,
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { id: "1", name: "Option 1" },
  { id: "2", name: "Option 2" },
];

const SelectContent = () => (
  <>
    <Label>Select an option</Label>
    <Button>
      <SelectValue />
      <SelectChevronUpDownIcon />
    </Button>
    <Popover>
      <ListBox>
        {options.map((option) => (
          <SelectItem key={option.id} id={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </ListBox>
    </Popover>
  </>
);

export const Default: Story = {
  args: {},
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const Small: Story = {
  args: {
    size: "S",
  },
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const Medium: Story = {
  args: {
    size: "M",
  },
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const Required: Story = {
  args: {
    isRequired: true,
  },
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
  },
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const Invalid: Story = {
  args: {
    isInvalid: true,
  },
  render: (args) => (
    <Select {...args}>
      <SelectContent />
    </Select>
  ),
};

export const WithLongOptions: Story = {
  args: {},
  render: (args) => (
    <Select {...args}>
      <Label>Select a long option</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <ListBoxItem id="1">
            This is a very long option that might wrap to multiple lines
          </ListBoxItem>
          <ListBoxItem id="2">
            Another long option that demonstrates how the component handles text
            overflow
          </ListBoxItem>
          <ListBoxItem id="3">
            A third option that shows how the dropdown handles multiple items
          </ListBoxItem>
        </ListBox>
      </Popover>
    </Select>
  ),
};
