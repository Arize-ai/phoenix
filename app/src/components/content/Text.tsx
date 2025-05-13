import { CSSProperties, forwardRef, ReactNode, Ref } from "react";
import {
  Text as AriaText,
  TextProps as AriaTextProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import {
  ColorValue,
  DOMProps,
  StyleProps,
  TextColorValue,
  TextSize,
} from "@phoenix/components/types";

import { colorValue, useStyleProps } from "../utils";

import { textBaseCSS } from "./styles";
import { TextElementType, Weight } from "./types";

export interface TextProps extends AriaTextProps, DOMProps, StyleProps {
  /**
   * Sets text size
   * @default 'S'
   */
  size?: TextSize;
  /**
   * The text node element type
   * @default 'span'
   */
  elementType?: TextElementType;
  /**
   * Sets the font weight
   * @default 'normal'
   */
  weight?: Weight;
  /**
   * Text content.
   */
  children: ReactNode;
  /**
   * The color of the text
   * @default 'text-900'
   */
  color?: TextColorValue;
  /**
   * The font style
   * @default 'normal'
   */
  fontStyle?: CSSProperties["fontStyle"];
  /**
   * The disabled state of the text
   */
  isDisabled?: boolean;
}

const getTextColor = (color: TextColorValue): string => {
  if (color === "inherit") {
    return "inherit";
  }
  if (color.startsWith("text-")) {
    const [, num] = color.split("-");
    return `var(--ac-global-text-color-${num})`;
  }
  return colorValue(color as ColorValue);
};

const textCSS = (color: TextColorValue) =>
  css(
    css`
      color: ${getTextColor(color)};
    `,
    textBaseCSS
  );

/**
 * Text is used to create various sizes of typographic hierarchies.
 */
function Text(props: TextProps, ref: Ref<HTMLElement>) {
  const { isDisabled = false } = props;
  const {
    children,
    color = isDisabled ? "text-300" : "text-900",
    size = "S",
    weight = "normal",
    fontStyle = "normal",
    ...otherProps
  } = props;
  const { styleProps } = useStyleProps(otherProps);

  return (
    <AriaText
      className="ac-text"
      {...otherProps}
      {...styleProps}
      css={css`
        ${textCSS(color)};
        font-style: ${fontStyle};
      `}
      data-size={size}
      data-weight={weight}
      ref={ref}
    >
      {children}
    </AriaText>
  );
}

const _Text = forwardRef(Text);
export { _Text as Text };
