import type { Meta, StoryObj } from "@storybook/react";

import { List, ListItem } from "@phoenix/components";

const meta: Meta<typeof List> = {
  title: "List",
  component: List,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["S", "M"],
      description: "The size of the list items",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default list with medium size
 */
export const Default: Story = {
  render: (args) => (
    <List {...args} style={{ color: "var(--ac-global-text-color-900)" }}>
      <ListItem>First item</ListItem>
      <ListItem>Second item</ListItem>
      <ListItem>Third item</ListItem>
    </List>
  ),
  args: {
    size: "M",
  },
};

/**
 * List with small size for more compact display
 */
export const Small: Story = {
  render: (args) => (
    <List {...args} style={{ color: "var(--ac-global-text-color-900)" }}>
      <ListItem>First item</ListItem>
      <ListItem>Second item</ListItem>
      <ListItem>Third item</ListItem>
    </List>
  ),
  args: {
    size: "S",
  },
};
