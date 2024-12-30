import React, { forwardRef, Ref } from "react";
import {
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";
export interface TextFieldProps extends AriaTextFieldProps, SizingProps {}

const textFieldCSS = css`
  display: flex;
  flex-direction: column;
  width: fit-content;

  &[data-size="M"] {
    --textfield-input-height: 30px;
    --textfield-vertical-padding: 6px;
    --textfield-horizontal-padding: 6px;
  }
  &[data-size="L"] {
    --textfield-input-height: 38px;
    --textfield-vertical-padding: 10px;
    --textfield-horizontal-padding: var(--ac-global-dimension-static-size-200);
  }

  .react-aria-Input,
  .react-aria-TextArea {
    margin: 0;
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    padding: var(--textfield-vertical-padding)
      var(--textfield-horizontal-padding);
    box-sizing: border-box;
    outline-offset: -1px;
    outline: 1px solid transparent;
    &[data-focused] {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
    }
  }
  .react-aria-Input {
    /* TODO: remove this sizing */
    height: var(--textfield-input-height);
  }
`;
function TextField(props: TextFieldProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaTextField
      data-size={size}
      ref={ref}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS)}
    />
  );
}

const _TextField = forwardRef(TextField);
export { _TextField as TextField };
