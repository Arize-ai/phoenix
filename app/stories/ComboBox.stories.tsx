import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import {
  ComboBox,
  ComboBoxItem,
  ComboBoxProps,
} from "@phoenix/components/combobox/ComboBox";

import { ThemeWrapper } from "./components/ThemeWrapper";

const meta: Meta = {
  title: "ComboBox",
  component: ComboBox,
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

const Template: StoryFn<ComboBoxProps<object>> = (args) => (
  <ThemeWrapper>
    <View width="300px">
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
    </View>
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
        <ComboBox label="Ice cream flavor (L)" size="L">
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
