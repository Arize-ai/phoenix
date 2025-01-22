import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Card } from "@arizeai/components";

import { Radio, RadioGroup, type RadioGroupProps } from "@phoenix/components";

const meta: Meta = {
  title: "RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
  },
};

export default meta;

const Template: StoryFn<RadioGroupProps> = (args) => (
  <Card
    title="RadioGroup"
    bodyStyle={{ padding: 0, width: "600px" }}
    variant="compact"
  >
    <RadioGroup {...args}>
      <Radio value="1">Option 1</Radio>
      <Radio value="2">Option 2</Radio>
      <Radio value="3">Option 3</Radio>
    </RadioGroup>
  </Card>
);

export const Default: Meta<typeof RadioGroup> = {
  render: Template,
  args: { size: "M", isDisabled: false, defaultValue: "1" },
  argTypes: {
    size: {
      control: { type: "select", options: ["S", "M", "L"] },
    },
  },
};
