import React from "react";
import { Meta, StoryFn } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";
import { GLOBAL_COLORS } from "./constants/colorConstants";

const meta: Meta = {
  title: "Colors",
};

export default meta;

const Template: StoryFn = () => (
  <ThemeWrapper>
    <Flex direction="row" wrap>
      {GLOBAL_COLORS.map((color) => (
        <View
          backgroundColor={color}
          key={color}
          height={50}
          width={100}
          padding="size-50"
        >
          <Text size="XS">{color}</Text>
        </View>
      ))}
    </Flex>
  </ThemeWrapper>
);

export const Default = Template.bind({});
