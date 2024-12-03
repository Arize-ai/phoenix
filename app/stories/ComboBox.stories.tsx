import React from "react";
import { Meta, StoryFn } from "@storybook/react";

// import { withDesign } from "storybook-addon-designs";
import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/comobox/ComboBox";

const meta: Meta = {
  title: "ComboBox",
  component: ComboBox,
  //   decorators: [withDesign],
  argTypes: {
    children: {
      control: {
        type: "text",
        default: "Label",
      },
    },
  },
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

export const Template: StoryFn<ComboBoxProps<object>> = (args) => (
  <ComboBox {...args}>
    <ComboBoxItem>Chocolate</ComboBoxItem>
    <ComboBoxItem>Mint</ComboBoxItem>
    <ComboBoxItem>Strawberry</ComboBoxItem>
    <ComboBoxItem>Vanilla</ComboBoxItem>
  </ComboBox>
);

export const Default = Template.bind({});

Default.args = {
  label: "Ice cream flavor",
};
