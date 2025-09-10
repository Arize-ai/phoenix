import type { Meta, StoryObj } from "@storybook/react";

import { Loading } from "@phoenix/components";

const meta: Meta<typeof Loading> = {
  title: "Loading",
  component: Loading,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof Loading>;

/**
 * Loading component displays a progress circle with optional message
 */
export const Default: Story = {
  args: {},
};

/**
 * Loading with a custom message
 */
export const WithMessage: Story = {
  args: {
    message: "Loading data...",
  },
};

/**
 * Loading with different sizes
 */

export const Small: Story = {
  args: {
    message: "Small loading indicator",
    size: "S",
  },
};

export const Medium: Story = {
  args: {
    message: "Medium loading indicator",
    size: "M",
  },
};

/**
 * Loading without message
 */
export const NoMessage: Story = {
  args: {
    message: undefined,
  },
};
