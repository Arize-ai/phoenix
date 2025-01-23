import React from "react";
import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { SizingProps, StylableProps } from "@phoenix/components/types";

const baseRadioGroupCSS = css(`
  // fixes esoteric overflow bug with VisuallyHidden, which is used by Radio
  // If position is not set to relative, the radio group will explode the parent layout
  // This will impact any other react aria component that uses VisuallyHidden
  // https://github.com/adobe/react-spectrum/issues/5094
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: fit-content;
  gap: var(--ac-global-dimension-size-200);
  font-size: 14px;
  line-height: 21px;

  & > .ac-radio:not(:first-child) {
    border-left: none;
  }

  & > .ac-radio:first-child {
    border-radius: var(--ac-global-rounding-small) 0 0 var(--ac-global-rounding-small);
  }

  & > .ac-radio:last-child {
    border-radius: 0 var(--ac-global-rounding-small) var(--ac-global-rounding-small) 0;
  }

  &[data-direction="column"] {
    flex-direction: column;
  }

  &[data-size="S"] {
    .ac-radio {
      padding: var(--ac-global-dimension-size-25) var(--ac-global-dimension-size-100);
    }
  }

  &[data-size="L"] {
    .ac-radio {
      padding: var(--ac-global-dimension-size-100) var(--ac-global-dimension-size-150);
    }
  }

  &:has(.ac-radio[data-focus-visible]) {
    border-radius: var(--ac-global-rounding-small);
    outline: 1px solid var(--ac-global-input-field-border-color-active);
    outline-offset: 8px;
  }
`);

export type RadioGroupProps = AriaRadioGroupProps;

export const RadioGroup = ({
  size,
  css: cssProp,
  className,
  direction,
  ...props
}: RadioGroupProps &
  SizingProps &
  StylableProps & { direction?: "row" | "column" }) => {
  return (
    <AriaRadioGroup
      data-size={size}
      data-direction={direction}
      className={classNames("ac-radio-group", className)}
      css={css(baseRadioGroupCSS, cssProp)}
      {...props}
    />
  );
};
