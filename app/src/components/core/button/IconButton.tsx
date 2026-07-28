import type { SerializedStyles } from "@emotion/react";
import { css } from "@emotion/react";
import type { ReactNode } from "react";
import type { ButtonProps } from "react-aria-components";
import { Button } from "react-aria-components";

import type { ColorValue, TextColorValue } from "../types";
import type { ComponentSize } from "../types/sizing";
import { colorValue } from "../utils";

export type IconButtonVariant = "default" | "danger";

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
   * The visual intent of the icon button. Danger buttons retain their regular
   * color at rest and use semantic danger colors on hover.
   * @default 'default'
   */
  variant?: IconButtonVariant;
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
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
  position: relative;
  padding: 0;

  &[data-size="S"] {
    width: var(--global-button-height-s);
    min-width: var(--global-button-height-s);
    min-height: var(--global-button-height-s);
    height: var(--global-button-height-s);
    .icon-wrap {
      font-size: var(--icon-button-font-size-s);
    }
  }

  &[data-size="M"] {
    width: var(--global-button-height-m);
    min-width: var(--global-button-height-m);
    min-height: var(--global-button-height-m);
    height: var(--global-button-height-m);
    .icon-wrap {
      font-size: var(--icon-button-font-size-m);
    }
  }

  .icon-wrap {
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }

  &[data-hovered] {
    background-color: var(--hover-background);
    .icon-wrap {
      opacity: 1;
    }
  }

  &[data-variant="danger"]:hover:not([data-disabled]),
  &[data-variant="danger"][data-hovered] {
    color: var(--global-icon-button-danger-foreground-color-hover);
    background-color: var(--global-icon-button-danger-background-color-hover);
  }

  &[data-pressed] {
    background-color: var(--global-color-primary-100);
    color: var(--global-text-color-900);
  }

  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }

  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
    cursor: not-allowed;
  }
`;

export function IconButton({
  size = "M",
  color = "text-700",
  variant = "default",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      css={iconButtonCSS(color)}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </Button>
  );
}
