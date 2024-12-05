import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/comobox/ComboBox";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "ComboBox",
  component: ComboBox,
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

const Template: StoryFn<ComboBoxProps<object>> = (args) => (
  <ThemeWrapper>
    <ComboBox {...args}>
      <ComboBoxItem textValue="Chocolate" key={"chocolate"}>
        Chocolate
      </ComboBoxItem>
      <ComboBoxItem textValue="Mint" key={"mint"}>
        Mint
      </ComboBoxItem>
      <ComboBoxItem textValue="Strawberry" key={"strawberry"}>
        Strawberry
      </ComboBoxItem>
      <ComboBoxItem textValue="Vanilla" key={"vanilla"}>
        Vanilla
      </ComboBoxItem>
    </ComboBox>
  </ThemeWrapper>
);

export const Default = Template.bind({});

Default.args = {
  label: "Ice cream flavor",
};

export const Disabled = Template.bind({});
Disabled.args = {
  label: "Ice cream flavor",
  isDisabled: true,
};

export const Invalid = Template.bind({});
Invalid.args = {
  label: "Ice cream flavor",
  isInvalid: true,
  errorMessage: "Please select a valid flavor",
};
