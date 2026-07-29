import type { Meta, StoryObj } from "@storybook/react";

import { ChartSkeleton } from "@phoenix/components/chart";

const meta = {
  title: "Charting/ChartSkeleton",
  component: ChartSkeleton,
  parameters: {
    layout: "centered",
  },
  args: {
    height: 190,
  },
  render: (args) => (
    <div style={{ width: 400 }}>
      <ChartSkeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof ChartSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Wave: Story = {
  args: {
    animation: "wave",
  },
};

export const WithoutLegend: Story = {
  args: {
    showLegend: false,
  },
};

export const CustomBars: Story = {
  args: {
    barValues: [35, 72, 48, 64, 30, 84, 58, 78, 44, 68, 52, 90, 40, 62, 36, 74],
  },
};
