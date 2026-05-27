import type { Meta, StoryObj } from "@storybook/react";

import { SparklineSkeleton } from "@phoenix/components/chart";

const meta = {
  title: "Charting/SparklineSkeleton",
  component: SparklineSkeleton,
  parameters: {
    layout: "centered",
  },
  args: {
    height: 72,
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <SparklineSkeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof SparklineSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dense: Story = {
  args: {
    barHeights: [
      "35%",
      "72%",
      "48%",
      "64%",
      "30%",
      "84%",
      "58%",
      "78%",
      "44%",
      "68%",
      "52%",
      "90%",
    ],
    gridLineCount: 4,
    height: 96,
  },
};
