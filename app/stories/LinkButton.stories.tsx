import { Meta, StoryFn } from "@storybook/react";

import { LinkButton, LinkButtonProps } from "@phoenix/components";

const meta: Meta = {
  title: "LinkButton",
  component: LinkButton,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<LinkButtonProps> = (args) => <LinkButton {...args} />;

/**
 * Buttons are used to perform actions within the UI
 */
export const Default = Template.bind({});

Default.args = {
  children: "LinkButton",
};

/**
 * Use the `variant` prop to change the appearance of the button
 */
export const Danger = Template.bind({});

Danger.args = {
  children: "Danger",
  variant: "danger",
};
