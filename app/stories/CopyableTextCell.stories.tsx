import type { Meta, StoryObj } from "@storybook/react";

import { CopyableTextCell } from "@phoenix/components/table/CopyableTextCell";

const meta: Meta<typeof CopyableTextCell> = {
  title: "Table/CopyableTextCell",
  component: CopyableTextCell,
};

export default meta;

type Story = StoryObj<typeof CopyableTextCell>;

export const Default: Story = {
  args: {
    value: "8ba22f7b2ee5d0f4",
  },
};

/** Long values truncate; the copy control still copies the full text. */
export const LongValue: Story = {
  args: {
    value: "user-3f7b2ee5d0f48ba2-very-long-identifier-that-truncates",
  },
};

/** Null or empty values render a "--" placeholder. */
export const Empty: Story = {
  args: {
    value: null,
  },
};
