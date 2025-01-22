import React from "react";
import {
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { SizingProps, StylableProps } from "@phoenix/components/types";

const baseRadioGroupCSS = css(`
  display: flex;
  flex-direction: row;
  align-items: center;

  font-size: 14px;
  line-height: 20px;

  & > .ac-radio:not(:first-child) {
    border-left: none;
  }

  & > .ac-radio:first-child {
    border-radius: 4px 0 0 4px;
  }

  & > .ac-radio:last-child {
    border-radius: 0 4px 4px 0;
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
    border-radius: 4px;
    outline: 1px solid var(--ac-global-input-field-border-color-active);
    outline-offset: 1px;
  }
`);

export type RadioGroupProps = AriaRadioGroupProps;

export const RadioGroup = ({
  size,
  css: cssProp,
  className,
  ...props
}: RadioGroupProps & SizingProps & StylableProps) => {
  return (
    <AriaRadioGroup
      data-size={size}
      className={classNames("ac-radio-group", className)}
      css={css(baseRadioGroupCSS, cssProp)}
      {...props}
    />
  );
};
