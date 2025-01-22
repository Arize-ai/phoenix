import React from "react";
import {
  Radio as AriaRadio,
  type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { classNames } from "@phoenix/components";
import { StylableProps } from "@phoenix/components/types";

const baseRadioCSS = css(`
    padding: var(--ac-global-dimension-size-50) var(--ac-global-dimension-size-100);
    border: 1px solid var(--ac-global-input-field-border-color);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    &[data-selected="true"] {
      background-color: var(--ac-global-button-primary-background-color);
    }
    &[data-hovered]:not([data-disabled]):not([data-selected="true"]) {
      background-color: var(--ac-global-button-primary-background-color-hover);
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
