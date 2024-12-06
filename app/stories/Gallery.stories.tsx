import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, Item,Picker } from "@arizeai/components";

import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/combobox/ComboBox";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "Gallery",

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const Template: StoryFn<ComboBoxProps<object>> = () => (
  <ThemeWrapper>
    <Flex direction="row" gap="size-200">
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
      <Picker label="Toppings" size="compact">
        <Item key="chocolate">Chocolate</Item>
        <Item key="mint">Mint</Item>
        <Item key="strawberry">Strawberry</Item>
        <Item key="vanilla">Vanilla</Item>
      </Picker>
    </Flex>
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
      <Picker label="Toppings" size="compact">
        <Item key="chocolate">Chocolate</Item>
        <Item key="mint">Mint</Item>
        <Item key="strawberry">Strawberry</Item>
        <Item key="vanilla">Vanilla</Item>
      </Picker>
    </Flex>
  </ThemeWrapper>
);

export const Default = Template.bind({});
