import type { Meta, StoryObj } from "@storybook/react";

import { BaselineExperimentBadge } from "@phoenix/components/experiment";

const meta: Meta<typeof BaselineExperimentBadge> = {
  title: "Experiment/BaselineExperimentBadge",
  component: BaselineExperimentBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["S", "M", "L"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BaselineExperimentBadge>;

/**
 * A passive badge that indicates an experiment is the baseline.
 */
export const Default: Story = {
  args: {
    size: "S",
  },
};

/**
 * The badge in all available sizes.
 */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <BaselineExperimentBadge size="S" />
      <BaselineExperimentBadge size="M" />
      <BaselineExperimentBadge size="L" />
    </div>
  ),
};
