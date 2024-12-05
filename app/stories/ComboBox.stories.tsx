import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/combobox/ComboBox";

import { ThemeWrapper } from "./components/ThemeWrapper";
import { Flex } from "@arizeai/components";

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

export function Gallery() {
  return (
    <ThemeWrapper>
      <Flex direction="column" gap="size-200">
        <ComboBox label="Ice cream flavor">
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
        <ComboBox label="Ice cream flavor (Invalid)" isInvalid>
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
        <ComboBox label="Ice cream flavor (Disabled)" isDisabled>
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
      </Flex>
    </ThemeWrapper>
  );
}
