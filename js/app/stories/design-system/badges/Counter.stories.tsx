import type { Meta } from "@storybook/react";

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
