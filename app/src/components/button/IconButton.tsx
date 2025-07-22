import { ReactNode } from "react";
import { Button, ButtonProps } from "react-aria-components";
import { css, SerializedStyles } from "@emotion/react";

import { ColorValue, TextColorValue } from "../types";
import { ComponentSize } from "../types/sizing";
import { colorValue } from "../utils";

const getIconButtonColor = (color: TextColorValue): string => {
  if (color === "inherit") {
    return "inherit";
  }
  if (color.startsWith("text-")) {
    const [, num] = color.split("-");
    return `var(--ac-global-text-color-${num})`;
  }
  return colorValue(color as ColorValue);
};

export interface IconButtonProps extends Omit<ButtonProps, "children"> {
  /**
   * The size of the button
   * @default 'M'
   */
  size?: Exclude<ComponentSize, "L">;
  /**
   * The icon to display
   */
  children: ReactNode;
  /**
   * The color of the button and icon
   * @default 'text-700'
   */
  color?: TextColorValue;
  /**
   * Custom CSS styles
   */
  css?: SerializedStyles;
}

const iconButtonCSS = (color: TextColorValue) => css`
  --icon-button-font-size-s: var(--ac-global-font-size-l);
  --icon-button-font-size-m: var(--ac-global-font-size-xl);
  --icon-button-font-size-l: var(--ac-global-font-size-2xl);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--ac-global-border-size-thin) solid transparent;
  border-radius: var(--ac-global-rounding-small);
  color: ${getIconButtonColor(color)};
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  padding: 0;

  &[data-size="S"] {
    width: 30px;
    height: 30px;
    .ac-icon-wrap {
      font-size: var(--icon-button-font-size-s);
    }
  }

  &[data-size="M"] {
    width: 38px;
    height: 38px;
    .ac-icon-wrap {
      font-size: var(--icon-button-font-size-m);
    }
  }

  .ac-icon-wrap {
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  &[data-hovered] {
    background-color: var(--ac-hover-background);
    .ac-icon-wrap {
      opacity: 1;
    }
  }

  &[data-pressed] {
    background-color: var(--ac-global-color-primary-100);
    color: var(--ac-global-text-color-900);
  }

  &[data-focus-visible] {
    outline: var(--ac-global-border-size-thick) solid var(--ac-focus-ring-color);
    outline-offset: var(--ac-global-border-offset-thin);
  }

  &[data-disabled] {
    opacity: var(--ac-global-opacity-disabled);
    cursor: not-allowed;
  }
`;

export function IconButton({
  size = "M",
  color = "text-700",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button css={iconButtonCSS(color)} data-size={size} {...props}>
      {children}
    </Button>
  );
}
