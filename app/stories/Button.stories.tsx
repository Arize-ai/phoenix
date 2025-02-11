import React from "react";
import { Meta, StoryFn } from "@storybook/react";
import { css } from "@emotion/react";

import { Button, ButtonProps } from "@phoenix/components";

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
    /* TODO: we need to make it simpler to not have to make styles more specific */
    border-color: var(--ac-global-color-primary) !important;
  `,
  children: "Custom",
};

export const WithKeyboard = Template.bind({});

WithKeyboard.args = {
  children: "With Keyboard",
  icon: "Mod-Enter",
};
