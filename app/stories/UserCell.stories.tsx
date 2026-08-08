import type { Meta, StoryObj } from "@storybook/react";

import { UserCell } from "@phoenix/components/table/UserCell";

const meta: Meta<typeof UserCell> = {
  title: "Table/UserCell",
  component: UserCell,
};

export default meta;

type Story = StoryObj<typeof UserCell>;

export const Default: Story = {
  args: {
    user: { username: "alice" },
  },
};

/** Records with no attributed user fall back to "system". */
export const NoUser: Story = {
  args: {
    user: null,
  },
};
