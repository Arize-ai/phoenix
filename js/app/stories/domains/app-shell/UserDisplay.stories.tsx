import type { Meta, StoryObj } from "@storybook/react";

import { UserDisplay } from "@phoenix/components/user/UserDisplay";

const meta: Meta<typeof UserDisplay> = {
  title: "Domains/App shell/User Display",
  tags: ["legacy", "unreviewed"],
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

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
};
