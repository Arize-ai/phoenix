import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Button, ButtonProps } from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Button",
  component: Button,
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<ButtonProps> = (args) => (
  <ThemeWrapper>
    <Button {...args} />
  </ThemeWrapper>
);

export const Default = Template.bind({});

Default.args = {
  children: "Button",
};
