import type { Meta, StoryObj } from "@storybook/react";

import { UserDisplay } from "@phoenix/components/user/UserDisplay";

const meta: Meta<typeof UserDisplay> = {
  title: "User/UserDisplay",
  component: UserDisplay,
};

export default meta;

type Story = StoryObj<typeof UserDisplay>;

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
