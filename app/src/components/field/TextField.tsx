import React, { forwardRef, Ref } from "react";
import {
  NumberField as AriaNumberField,
  NumberFieldProps as AriaNumberFieldProps,
  TextField as AriaTextField,
  TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";

import { textFieldCSS } from "./styles";

export interface TextFieldProps extends AriaTextFieldProps, SizingProps {}
export interface NumberFieldProps extends AriaNumberFieldProps, SizingProps {}

function TextField(props: TextFieldProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaTextField
      data-size={size}
      className="ac-textfield"
      ref={ref}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS)}
    />
  );
}

const _TextField = forwardRef(TextField);

const NumberField = forwardRef(function NumberField(
  props: NumberFieldProps,
  ref: Ref<HTMLDivElement>
) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaNumberField
      data-size={size}
      className="ac-textfield"
      ref={ref}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS)}
    />
  );
});

export { _TextField as TextField, NumberField };
