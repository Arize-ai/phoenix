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
  "grey-50",
  "grey-75",
  "grey-100",
  "grey-200",
  "grey-300",
  "grey-400",
  "grey-500",
  "grey-600",
  "grey-700",
  "grey-800",
  "grey-900",
  "blue-100",
  "blue-200",
  "blue-300",
  "blue-400",
  "blue-500",
  "blue-600",
  "blue-700",
  "blue-800",
  "blue-900",
  "blue-1000",
  "blue-1100",
  "blue-1200",
  "blue-1300",
  "blue-1400",
  "red-100",
  "red-200",
  "red-300",
  "red-400",
  "red-500",
  "red-600",
  "red-700",
  "red-800",
  "red-900",
  "red-1000",
  "red-1100",
  "red-1200",
  "red-1300",
  "red-1400",
  "orange-100",
  "orange-200",
  "orange-300",
  "orange-400",
  "orange-500",
  "orange-600",
  "orange-700",
  "orange-800",
  "orange-900",
  "yellow-100",
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
            <Text key={color} textSize="xlarge" color={color} weight="heavy">
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
              textSize="xlarge"
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
