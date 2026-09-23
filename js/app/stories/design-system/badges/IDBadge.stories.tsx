import type { Meta, StoryObj } from "@storybook/react";

import { IDBadge } from "@phoenix/components";

/**
 * A badge that displays an entity's ID and copies it to the clipboard when
 * pressed — the single, consolidated click-to-copy ID element. Clicking the
 * badge copies the ID and briefly shows a checkmark; no separate copy button
 * is needed alongside it.
 */
const meta = {
  title: "Design System/Badges/ID Badge",
  component: IDBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["legacy", "unreviewed"],
} satisfies Meta<typeof IDBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

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

/**
 * The quiet variant renders bare muted mono text for blending into
 * surrounding metadata, with a background wash on hover as the invitation
 * to click-to-copy.
 */
export const Quiet: Story = {
  args: {
    id: "c5b943dba87507a2",
    variant: "quiet",
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: Story = {
  tags: ["!dev", "!autodocs"],
  args: {
    id: "c5b943dba87507a2",
  },
  render: (args) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <IDBadge {...args} />
      <IDBadge {...args} variant="quiet" />
    </div>
  ),
};
