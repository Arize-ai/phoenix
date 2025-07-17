/* eslint-disable deprecate/import */
import { Meta } from "@storybook/react";
import { css } from "@emotion/react";

import { Flex, Text, TextProps } from "@phoenix/components";

import { GLOBAL_COLORS } from "./constants/colorConstants";

const meta: Meta = {
  title: "Text",
  component: Text,

  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

const sizes: TextProps["size"][] = ["XS", "S", "M", "L"];

const colors: TextProps["color"][] = [
  "text-900",
  "text-700",
  "text-300",
  "success",
  "danger",
  "warning",
  ...GLOBAL_COLORS,
];

/**
 * A gallery of all the variants
 */
export const Gallery = () => {
  return (
    <Flex direction="row" gap="size-200" alignItems="start" height="1000px">
      <GalleryComponent />
    </Flex>
  );
};

function GalleryComponent() {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <p
        css={css`
          .ac-text {
            display: block;
          }
        `}
      >
        {sizes.map((size) => {
          return (
            <Text key={size} size={size}>
              {`I will not waste chalk`}
            </Text>
          );
        })}
      </p>
      <p
        css={css`
          .ac-text {
            display: block;
          }
        `}
      >
        {sizes.map((size) => {
          return (
            <Text key={size} size={size} weight="heavy">
              {`I will not waste chalk`}
            </Text>
          );
        })}
      </p>
      <p
        css={css`
          .ac-text {
            display: block;
          }
        `}
      >
        {colors.map((color) => {
          return (
            <Text key={color} size="L" color={color} weight="heavy">
              {`I will not waste chalk`}
            </Text>
          );
        })}
      </p>
    </div>
  );
}
