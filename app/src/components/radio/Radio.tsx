import {
  Radio as AriaRadio,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { StylableProps } from "@phoenix/components/types";
import { classNames } from "@phoenix/utils";

const baseRadioCSS = css(`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  font-size: 14px;
  color: var(--global-text-color-900);
  forced-color-adjust: none;

  &:before {
    content: '';
    display: block;
    width: 1.286rem;
    height: 1.286rem;
    box-sizing: border-box;
    border: 0.143rem solid var(--global-input-field-border-color);
    background: var(--global-input-field-background-color);
    border-radius: 1.286rem;
    transition: all 200ms;
  }

  &[data-pressed]:before {
    border-color: var(--global-input-field-border-color-active);
  }

  &[data-selected] {
    &:before {
      border-color: var(--global-button-primary-background-color);
      border-width: 0.429rem;
    }

    &[data-pressed]:before {
      border-color: var(--global-button-primary-background-color-active);
    }
  }

  &[data-focus-visible]:before {
    outline: 2px solid var(--global-input-field-border-color-active);
    outline-offset: 2px;
  }

  &[data-disabled] {
    opacity: var(--global-opacity-disabled);
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
