import { css } from "@emotion/react";
import type { Meta } from "@storybook/react";

import { Button } from "@phoenix/components";
import { Keyboard, VisuallyHidden } from "@phoenix/components/core/content";
const meta: Meta = {
  title: "Core/Actions/Button",
  component: Button,
  parameters: {
    layout: "centered",
    design: {
      type: "figma",
      url: "https://www.figma.com/design/rMddnj6eV2TcQqNkejJ9qX/Core?node-id=111-2047",
    },
  },
};

export default meta;

export const Default = {
  args: {
    children: "Button",
  },
};

export const Danger = {
  args: {
    children: "Danger",
    variant: "danger",
  },
};

export const CustomCSS = {
  args: {
    css: css`
      --button-border-color: pink;
    `,
    children: "Custom",
  },
};

export const Quiet = {
  args: {
    children: "Quiet",
    variant: "quiet",
  },
};

export const WithKeyboard = {
  args: {
    children: "With Keyboard",
    size: "S",
    variant: "primary",
    trailingVisual: (
      <Keyboard>
        <VisuallyHidden>modifier</VisuallyHidden>
        <span aria-hidden="true">⌘</span>
        <VisuallyHidden>enter</VisuallyHidden>
        <span aria-hidden="true">⏎</span>
      </Keyboard>
    ),
  },
};
