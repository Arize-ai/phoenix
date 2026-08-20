import type { Meta, StoryObj } from "@storybook/react";

import { View } from "@phoenix/components";
import { ThemeToggle } from "@phoenix/components/nav";

/**
 * A compact segmented control for switching between light, dark, and system
 * theme modes. Lives in the account menu at the bottom of the side nav.
 */
const meta: Meta<typeof ThemeToggle> = {
  title: "Nav/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <View width="250px">
        <Story />
      </View>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {};
