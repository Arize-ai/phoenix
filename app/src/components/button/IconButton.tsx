import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";
import type { ReactNode } from "react";
import type { ButtonProps } from "react-aria-components";
import { Button } from "react-aria-components";

import type { ColorValue, TextColorValue } from "../types";
import type { ComponentSize } from "../types/sizing";
import { colorValue } from "../utils";

const getIconButtonColor = (color: TextColorValue): string => {
  if (color === "inherit") {
    return "inherit";
  }
  if (color.startsWith("text-")) {
    const [, num] = color.split("-");
    return `var(--global-text-color-${num})`;
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
  --icon-button-font-size-s: var(--global-font-size-l);
  --icon-button-font-size-m: var(--global-font-size-xl);
  --icon-button-font-size-l: var(--global-font-size-2xl);

  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--global-border-size-thin) solid transparent;
  border-radius: var(--global-rounding-small);
  color: ${getIconButtonColor(color)};
  background-color: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  padding: 0;

  &[data-size="S"] {
    width: var(--global-button-height-s);
    min-width: var(--global-button-height-s);
    min-height: var(--global-button-height-s);
    height: var(--global-button-height-s);
    .ac-icon-wrap {
      font-size: var(--icon-button-font-size-s);
    }
  }

  &[data-size="M"] {
    width: var(--global-button-height-m);
    min-width: var(--global-button-height-m);
    min-height: var(--global-button-height-m);
    height: var(--global-button-height-m);
    .ac-icon-wrap {
      font-size: var(--icon-button-font-size-m);
    }
  }

  .ac-icon-wrap {
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  &[data-hovered] {
    background-color: var(--hover-background);
    .ac-icon-wrap {
      opacity: 1;
    }
  }

  &[data-pressed] {
    background-color: var(--global-color-primary-100);
    color: var(--global-text-color-900);
  }

  &[data-focus-visible] {
    outline: var(--global-border-size-thick) solid var(--focus-ring-color);
    outline-offset: var(--global-border-offset-thin);
  }

  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
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
