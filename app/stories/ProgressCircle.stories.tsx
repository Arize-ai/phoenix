import type { Meta, StoryObj } from "@storybook/react";

import { ProgressCircle } from "../src/components/progressCircle/ProgressCircle";
import type { ProgressCircleProps } from "../src/components/progressCircle/types";

const meta: Meta<typeof ProgressCircle> = {
  title: "ProgressCircle",
  component: ProgressCircle,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A circular progress indicator for loading or progress feedback. Supports determinate and indeterminate states.",
      },
    },
  },
  argTypes: {
    value: {
      control: { type: "number", min: 0, max: 100 },
      description: "Current progress value (0-100). Ignored if indeterminate.",
      defaultValue: 50,
    },
    isIndeterminate: {
      control: "boolean",
      description: "Whether the progress is indeterminate (spinning animation)",
      defaultValue: false,
    },
    size: {
      control: { type: "radio" },
      options: ["S", "M"],
      description: "Size of the progress circle",
      defaultValue: "M",
    },
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ProgressCircle>;

export const Determinate: Story = {
  args: {
    value: 60,
    isIndeterminate: false,
    size: "M",
  },
};

export const Indeterminate: Story = {
  args: {
    isIndeterminate: true,
    size: "M",
  },
};

export const Sizes: Story = {
  render: (args: ProgressCircleProps) => (
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <ProgressCircle {...args} size="S" />
      <ProgressCircle {...args} size="M" />
    </div>
  ),
  args: {
    value: 75,
    isIndeterminate: false,
  },
};
