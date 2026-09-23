import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { Flex, View } from "@phoenix/components";
import {
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components/core/tooltip";

import { GLOBAL_COLORS } from "../../constants/colorConstants";

const meta: Meta = {
  title: "Design System/Color/Colors",
  tags: ["legacy", "unreviewed"],
};

export default meta;

const Template: StoryFn = () => {
  // Group colors by family
  const colorsByFamily = GLOBAL_COLORS.reduce<
    Record<string, typeof GLOBAL_COLORS>
  >((acc, color) => {
    const family = color.split("-")[0];
    if (!acc[family]) {
      acc[family] = [];
    }
    acc[family].push(color);
    return acc;
  }, {});

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

export const Default = {
  tags: ["!dev"],
  render: Template,
};

/** The families shown in the Overview card picture: a sample, not the catalog. */
const THUMBNAIL_FAMILIES = [
  "gray",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
];

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => (
    <Flex direction="column" gap="size-50" width="100%">
      {THUMBNAIL_FAMILIES.map((family) => (
        <Flex key={family} direction="row">
          {GLOBAL_COLORS.filter((color) => color.startsWith(`${family}-`)).map(
            (color) => (
              <View key={color} backgroundColor={color} height={20} flex={1} />
            )
          )}
        </Flex>
      ))}
    </Flex>
  ),
};
