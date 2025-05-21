import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../src/components/button/Button";
import { Group } from "../src/components/layout/Group";

/**
 * Group visually connects a set of buttons or controls, making them appear as a single component.
 *
 * ## Usage
 * ```tsx
 * <Group>
 *   <Button>Left</Button>
 *   <Button>Middle</Button>
 *   <Button>Right</Button>
 * </Group>
 * ```
 *
 * The `size` prop can be used to control the sizing of the group and its children.
 */
const meta: Meta<typeof Group> = {
  title: "Layout/Group",
  component: Group,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    size: {
      control: "radio",
      options: ["S", "M", "L"],
      description: "Size of the group and its children",
      table: {
        type: { summary: "ComponentSize" },
        defaultValue: { summary: "M" },
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Group>;

export const Default: Story = {
  args: {
    size: "M",
    children: (
      <>
        <Button>Left</Button>
        <Button>Middle</Button>
        <Button>Right</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "A group of three buttons visually connected as a single component.",
      },
    },
  },
};

export const Small: Story = {
  args: {
    size: "S",
    children: (
      <>
        <Button>Left</Button>
        <Button>Middle</Button>
        <Button>Right</Button>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "Small size group.",
      },
    },
  },
};
