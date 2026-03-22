import type { Meta } from "@storybook/react";

import { LinkButton } from "@phoenix/components";

const meta: Meta = {
  title: "Core/Actions/Link Button",
  component: LinkButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default = {
  args: {
    children: "LinkButton",
  },
};

export const Danger = {
  args: {
    children: "Danger",
    variant: "danger",
  },
};
