import React from "react";
import {
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { StylableProps } from "@phoenix/components/types";

const baseToggleButtonCSS = css(`
    padding: var(--ac-global-dimension-size-50) var(--ac-global-dimension-size-100);
    border: 1px solid var(--ac-global-input-field-border-color);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    outline: none;
    min-height: 30px;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: var(--ac-global-dimension-static-size-50);

    &[data-selected="true"] {
      background-color: var(--ac-global-button-primary-background-color);
      border-color: var(--ac-global-button-primary-background-color);
    }
    &[data-selected="true"]:not(:first-child) {
      margin-left: -1px;
    }
    &[data-hovered]:not([data-disabled]):not([data-selected="true"]) {
      background-color: var(--ac-global-input-field-border-color-hover);
    }
    &[data-disabled] {
      opacity: var(--ac-global-opacity-disabled);
    }
    &[data-focus-visible] {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
      outline-offset: -2px;
    }
`);

export type ToggleButtonProps = AriaToggleButtonProps;

export const ToggleButton = ({
  className,
  css: cssProp,
  ...props
}: ToggleButtonProps & StylableProps) => {
  return (
    <AriaToggleButton
      className={classNames("ac-toggle-button", className)}
      css={css(baseToggleButtonCSS, cssProp)}
      {...props}
    />
  );
};
