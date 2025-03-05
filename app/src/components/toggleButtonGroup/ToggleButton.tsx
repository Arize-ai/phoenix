import React, { ReactNode, useCallback } from "react";
import {
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
  type ToggleButtonRenderProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { buttonCSS, ButtonProps } from "@phoenix/components/button";
import { StylableProps } from "@phoenix/components/types";

const baseToggleButtonCSS = css(
  buttonCSS,
  `
    &[data-selected="true"] {
      background-color: var(--ac-global-button-primary-background-color);
      border-color: var(--ac-global-button-primary-background-color);
      &:hover:not([data-disabled]) {
        background-color: var(--ac-global-button-primary-background-color-hover);
      }
    }
    &[data-selected="true"]:not(:first-child) {
      margin-left: -1px;
    }
    &[data-hovered]:not([data-disabled]):not([data-selected="true"]) {
      background-color: var(--ac-global-input-field-border-color-hover);
    }
    &[data-focus-visible] {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
      outline-offset: -2px;
    }
`
);

export interface ToggleButtonProps
  extends AriaToggleButtonProps,
    // Inherit the leading and trailing visuals. Might warrent moving to an interface
    Pick<ButtonProps, "leadingVisual" | "trailingVisual" | "size"> {}

export const ToggleButton = ({
  className,
  css: cssProp,
  ...props
}: ToggleButtonProps & StylableProps) => {
  const {
    leadingVisual,
    trailingVisual,
    size = "M",
    children,
    ...rest
  } = props;
  const renderContent = useCallback(
    (props: ToggleButtonRenderProps & { defaultChildren: ReactNode }) => {
      return (
        <>
          {leadingVisual}
          {typeof children === "function" ? children(props) : children}
          {trailingVisual}
        </>
      );
    },
    [leadingVisual, trailingVisual, children]
  );
  return (
    <AriaToggleButton
      css={css(baseToggleButtonCSS, cssProp)}
      data-size={size}
      data-childless={!children}
      className={classNames("ac-toggle-button", className)}
      {...rest}
    >
      {renderContent}
    </AriaToggleButton>
  );
};
