/* eslint-disable deprecate/import */
import React from "react";
import { Meta } from "@storybook/react";
import { css } from "@emotion/react";

import {
  Text as LegacyText,
  TextProps as LegacyTextProps,
} from "@arizeai/components";

import { Flex, Text, TextProps } from "@phoenix/components";

import { ThemeWrapper } from "./components/ThemeWrapper";
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
const legacySizes: LegacyTextProps["textSize"][] = [
  "small",
  "medium",
  "large",
  "xlarge",
];

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
    <ThemeWrapper>
      <Flex direction="row" gap="size-200" alignItems="start">
        <GalleryComponent />
        <LegacyGalleryComponent />
      </Flex>
    </ThemeWrapper>
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

      <p
        css={css`
          .ac-text {
            display: block;
          }
        `}
      >
        {colors.map((color) => {
          return (
            <Text
              key={color}
              fontStyle="italic"
              size="XL"
              color={color}
              weight="heavy"
            >
              {`I will not waste chalk`}
            </Text>
          );
        })}
      </p>
    </div>
  );
}

function LegacyGalleryComponent() {
  const Text = LegacyText;
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
        {legacySizes.map((size) => {
          return (
            <Text key={size} textSize={size}>
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
        {legacySizes.map((size) => {
          return (
            <Text key={size} textSize={size} weight="heavy">
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

      <p
        css={css`
          .ac-text {
            display: block;
          }
        `}
      >
        {colors.map((color) => {
          return (
            <Text
              key={color}
              fontStyle="italic"
              size="L"
              color={color}
              weight="heavy"
            >
              {`I will not waste chalk`}
            </Text>
          );
        })}
      </p>
    </div>
  );
}
