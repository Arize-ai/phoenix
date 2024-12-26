import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Button, ButtonProps } from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Button",
  component: Button,
  argTypes: {
    label: {
      control: {
        type: "text",
        default: "Label",
      },
    },
    isDisabled: {
      type: "boolean",
    },
    description: {
      type: "string",
      control: {
        type: "text",
      },
    },
    errorMessage: {
      type: "string",
      control: {
        type: "text",
      },
    },
    isInvalid: {
      control: {
        type: "boolean",
      },
    },
    isRequired: {
      control: {
        type: "boolean",
      },
    },
    menuTrigger: {
      options: ["manual", "input", "focus"],
      control: {
        type: "radio",
      },
    },
  },
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
