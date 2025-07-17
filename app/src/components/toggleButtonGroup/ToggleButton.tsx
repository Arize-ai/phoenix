import { ReactNode, useCallback } from "react";
import {
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
  type ToggleButtonRenderProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { buttonCSS, ButtonProps } from "@phoenix/components/button";
import { StylableProps } from "@phoenix/components/types";
import { useSize } from "@phoenix/contexts";

const baseToggleButtonCSS = css(
  buttonCSS,
  `
    text-wrap: nowrap;
    &[data-selected="true"] {
      background-color: var(--ac-global-button-primary-background-color);
      --button-border-color: var(--ac-global-button-primary-border-color);
      color: var(--ac-global-button-primary-foreground-color);
      &:hover:not([data-disabled]) {
        background-color: var(--ac-global-button-primary-background-color-hover);
      }
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
    size: propSize,
    children,
    ...rest
  } = props;
  // If the toggle button is nested under a button group, use the size of the button group
  const contextSize = useSize();
  const size = propSize ?? contextSize;
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
