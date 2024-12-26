import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, Item, Picker } from "@arizeai/components";

import { Button, View } from "@phoenix/components";
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
    <View
      borderWidth="thin"
      borderColor="dark"
      padding="size-200"
      borderRadius="medium"
    >
      <Flex direction="row" gap="size-200" alignItems="center">
        <ComboBox label="Ice cream flavor" description={"pick a flavor"}>
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
        <Picker label="Toppings" size="compact" description={"pick a flavor"}>
          <Item key="chocolate">Chocolate</Item>
          <Item key="mint">Mint</Item>
          <Item key="strawberry">Strawberry</Item>
          <Item key="vanilla">Vanilla</Item>
        </Picker>
        <Button size="S">Button</Button>
      </Flex>
      <Flex direction="row" gap="size-200" alignItems="center">
        <ComboBox
          label="Ice cream flavor"
          description={"pick a flavor"}
          size="L"
        >
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
        <Picker label="Toppings" size="default" description={"pick a flavor"}>
          <Item key="chocolate">Chocolate</Item>
          <Item key="mint">Mint</Item>
          <Item key="strawberry">Strawberry</Item>
          <Item key="vanilla">Vanilla</Item>
        </Picker>
        <Button size="M">Button</Button>
      </Flex>
    </View>
    <View
      padding="size-200"
      borderWidth="thin"
      borderColor="dark"
      borderRadius="medium"
      marginTop="size-200"
    >
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
        <ComboBox label="Ice cream flavor" size="L">
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
        <Picker label="Toppings" size="default">
          <Item key="chocolate">Chocolate</Item>
          <Item key="mint">Mint</Item>
          <Item key="strawberry">Strawberry</Item>
          <Item key="vanilla">Vanilla</Item>
        </Picker>
      </Flex>
    </View>
  </ThemeWrapper>
);

export const Default = Template.bind({});
