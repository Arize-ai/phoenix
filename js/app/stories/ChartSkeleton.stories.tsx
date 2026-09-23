import type { Meta, StoryObj } from "@storybook/react";

import { ChartSkeleton } from "@phoenix/components/chart";

const meta = {
  title: "Charting/ChartSkeleton",
  component: ChartSkeleton,
  parameters: {
    layout: "centered",
  },
  render: (args) => (
    <div style={{ width: 400, height: 190 }}>
      <ChartSkeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof ChartSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  render: (args) => (
    <div style={{ width: 400, height: 100 }}>
      <ChartSkeleton {...args} />
    </div>
  ),
};
