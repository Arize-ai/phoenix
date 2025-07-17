import { Meta, StoryFn } from "@storybook/react";
import { css } from "@emotion/react";

import { Button, ButtonProps } from "@phoenix/components";
import { Keyboard, VisuallyHidden } from "@phoenix/components/content";
const meta: Meta = {
  title: "Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<ButtonProps> = (args) => <Button {...args} />;

/**
 * Buttons are used to perform actions within the UI
 */
export const Default = Template.bind({});

Default.args = {
  children: "Button",
};

/**
 * Use the `variant` prop to change the appearance of the button
 */
export const Danger = Template.bind({});

Danger.args = {
  children: "Danger",
  variant: "danger",
};

export const CustomCSS = Template.bind({});

CustomCSS.args = {
  css: css`
    --button-border-color: pink;
  `,
  children: "Custom",
};

export const Quiet = Template.bind({});

Quiet.args = {
  children: "Quiet",
  variant: "quiet",
};

export const WithKeyboard = Template.bind({});

WithKeyboard.args = {
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
};
