import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type { TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { TextField as AriaTextField } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import type { SizingProps } from "@phoenix/components/types";

import { textFieldCSS } from "./styles";

export interface TextFieldProps extends AriaTextFieldProps, SizingProps {}

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

export { _TextField as TextField };
