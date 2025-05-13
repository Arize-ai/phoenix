import {
  Radio as AriaRadio,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { StylableProps } from "@phoenix/components/types";

const baseRadioCSS = css(`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);
  font-size: 14px;
  color: var(--ac-global-text-color-900);
  forced-color-adjust: none;

  &:before {
    content: '';
    display: block;
    width: 1.286rem;
    height: 1.286rem;
    box-sizing: border-box;
    border: 0.143rem solid var(--ac-global-input-field-border-color);
    background: var(--ac-global-input-field-background-color);
    border-radius: 1.286rem;
    transition: all 200ms;
  }

  &[data-pressed]:before {
    border-color: var(--ac-global-input-field-border-color-active);
  }

  &[data-selected] {
    &:before {
      border-color: var(--ac-global-button-primary-background-color);
      border-width: 0.429rem;
    }

    &[data-pressed]:before {
      border-color: var(--ac-global-button-primary-background-color-active);
    }
  }

  &[data-focus-visible]:before {
    outline: 2px solid var(--ac-global-input-field-border-color-active);
    outline-offset: 2px;
  }

  &[data-disabled] {
    opacity: var(--ac-global-opacity-disabled);
  }
`);

export type RadioProps = AriaRadioProps;

export const Radio = ({
  className,
  css: cssProp,
  ...props
}: RadioProps & StylableProps) => {
  return (
    <AriaRadio
      className={classNames("ac-radio", className)}
      css={css(baseRadioCSS, cssProp)}
      {...props}
    />
  );
};
