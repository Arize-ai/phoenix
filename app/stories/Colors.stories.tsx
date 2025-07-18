import { Meta, StoryFn } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/tooltip";

import { GLOBAL_COLORS } from "./constants/colorConstants";

const meta: Meta = {
  title: "Colors",
};

export default meta;

const Template: StoryFn = () => {
  // Group colors by family
  const colorsByFamily = GLOBAL_COLORS.reduce(
    (acc, color) => {
      const family = color.split("-")[0];
      if (!acc[family]) {
        acc[family] = [];
      }
      acc[family].push(color);
      return acc;
    },
    {} as Record<string, typeof GLOBAL_COLORS>
  );

  return (
    <Flex direction="column" gap="size-100">
      {Object.entries(colorsByFamily).map(([family, colors]) => (
        <Flex key={family} direction="row" wrap>
          {colors.map((color) => (
            <TooltipTrigger key={color} delay={0}>
              <TriggerWrap>
                <View
                  backgroundColor={color}
                  height={40}
                  width={40}
                  padding="size-50"
                ></View>
              </TriggerWrap>
              <Tooltip>{color}</Tooltip>
            </TooltipTrigger>
          ))}
        </Flex>
      ))}
    </Flex>
  );
};

export const Default = Template.bind({});
