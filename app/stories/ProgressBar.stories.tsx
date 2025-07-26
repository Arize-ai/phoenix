import type { Meta, StoryObj } from "@storybook/react";

import { ProgressBar } from "@phoenix/components";

const meta: Meta<typeof ProgressBar> = {
  title: "ProgressBar",
  component: ProgressBar,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "A linear progress indicator",
      },
    },
  },
  argTypes: {
    value: {
      control: { type: "number", min: 0, max: 100 },
      description: "Current progress value (0-100).",
      defaultValue: 60,
    },
    width: {
      control: { type: "text" },
      description:
        "Width of the progress bar (e.g. '200px', '100%'). Optional.",
    },
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const ProgressBarDefault: Story = {
  args: {
    value: 60,
  },
};

export const ProgressBarWithWidth: Story = {
  args: {
    value: 60,
    width: "40px",
  },
};

export const ProgressBarWithCustomColor: Story = {
  render: (args) => (
    <div
      style={{ "--mod-barloader-fill-color": "hotpink" } as React.CSSProperties}
    >
      <ProgressBar {...args} />
    </div>
  ),
  args: {
    value: 60,
  },
};
