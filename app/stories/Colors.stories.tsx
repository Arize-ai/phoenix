import { Meta, StoryFn } from "@storybook/react";

import { Flex, Text, View } from "@phoenix/components";

import { GLOBAL_COLORS } from "./constants/colorConstants";

const meta: Meta = {
  title: "Colors",
};

export default meta;

const Template: StoryFn = () => (
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
);

export const Default = Template.bind({});
