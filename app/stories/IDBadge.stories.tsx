import type { Meta, StoryObj } from "@storybook/react";

import { IDBadge } from "@phoenix/components";

/**
 * Displays an entity's ID as quiet metadata and copies it to the clipboard
 * when pressed. Clicking the ID briefly shows a checkmark; no separate copy
 * button is needed alongside it.
 */
const meta = {
  title: "Core/IDBadge",
  component: IDBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof IDBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

const LONG_ID = `span_${"0123456789abcdef".repeat(32)}`;

export const Default: Story = {
  args: {
    id: "c5b943dba87507a2",
  },
};

/**
 * The tooltip can name the entity being copied.
 */
export const CustomTooltip: Story = {
  args: {
    id: "c5b943dba87507a2",
    tooltipText: "Copy Span ID",
  },
};

/** Long IDs truncate at the component's maximum width. */
export const Long: Story = {
  args: {
    id: LONG_ID,
  },
};
