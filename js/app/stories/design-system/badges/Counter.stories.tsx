import type { Meta, StoryObj } from "@storybook/react";

import { Counter } from "@phoenix/components";
const meta: Meta = {
  title: "Design System/Badges/Counter",
  tags: ["legacy", "unreviewed"],
  component: Counter,
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default = {
  args: {
    children: "9",
  },
};

export const Danger = {
  args: {
    children: "12,000",
    variant: "danger",
  },
};

export const Quiet = {
  args: {
    children: "1.2k",
    variant: "quiet",
  },
};

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Counter>9</Counter>
      <Counter variant="danger">12,000</Counter>
      <Counter variant="quiet">1.2k</Counter>
    </div>
  ),
};
