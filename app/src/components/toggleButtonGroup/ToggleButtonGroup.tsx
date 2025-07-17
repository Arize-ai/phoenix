import {
  ToggleButtonGroup as AriaToggleButtonGroup,
  type ToggleButtonGroupProps as AriaToggleButtonGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { SizingProps, StylableProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts";

const baseToggleButtonGroupCSS = css(`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: fit-content;
  & > button {
    border-radius: 0;
    z-index: 1;

    &[data-disabled] {
      z-index: 0;
    }

    &[data-selected],
    &[data-focus-visible] {
      z-index: 2;
    }
  }

  & > .ac-toggle-button:not(:first-child):not([data-selected="true"]) {
    border-left: none;
  }
    
  & > .ac-toggle-button[data-selected="true"]:not(:first-child) {
    margin-left: -1px;
  }

  & > .ac-toggle-button:first-child {
    border-radius: var(--ac-global-rounding-small) 0 0 var(--ac-global-rounding-small);
  }

  & > .ac-toggle-button:last-child {
    border-radius: 0 var(--ac-global-rounding-small) var(--ac-global-rounding-small) 0;
  }

  &:has(.ac-toggle-button[data-focus-visible]) {
    border-radius: var(--ac-global-rounding-small);
    outline: 1px solid var(--ac-global-input-field-border-color-active);
    outline-offset: 1px;
  }
`);

export type ToggleButtonGroupProps = AriaToggleButtonGroupProps;

export const ToggleButtonGroup = ({
  size = "M",
  css: cssProp,
  className,
  selectionMode = "single",
  ...props
}: ToggleButtonGroupProps & SizingProps & StylableProps) => {
  return (
    <SizeProvider size={size}>
      <AriaToggleButtonGroup
        data-size={size}
        className={classNames("ac-toggle-button-group", className)}
        css={css(baseToggleButtonGroupCSS, cssProp)}
        selectionMode={selectionMode}
        {...props}
      />
    </SizeProvider>
  );
};
