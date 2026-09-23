import type { Meta, StoryObj } from "@storybook/react";

import { DocumentationHelp } from "@phoenix/components";

const meta: Meta<typeof DocumentationHelp> = {
  title: "Design System/Overlays/Documentation Help",
  tags: ["legacy", "unreviewed"],
  component: DocumentationHelp,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof DocumentationHelp>;

export const Default: Story = {
  args: {
    topic: "apiKeys",
    children: "Create credentials for automated access to Phoenix.",
  },
};
