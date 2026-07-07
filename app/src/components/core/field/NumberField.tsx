import { css } from "@emotion/react";
import type { Ref } from "react";
import type { NumberFieldProps as AriaNumberFieldProps } from "react-aria-components";
import { NumberField as AriaNumberField } from "react-aria-components";

import { fieldBaseCSS } from "@phoenix/components/core/field/styles";
import type { SizingProps } from "@phoenix/components/core/types";
import { classNames } from "@phoenix/utils/classNames";

import { selectReadOnlyInputOnFocus } from "./selectReadOnlyInputOnFocus";
import { textFieldCSS } from "./styles";

export interface NumberFieldProps extends AriaNumberFieldProps, SizingProps {}

const numberFieldCSS = css`
  .react-aria-Input {
    text-align: right;
    font-feature-settings: "tnum" 1;
  }
`;

function NumberField({
  ref,
  ...props
}: NumberFieldProps & { ref?: Ref<HTMLDivElement> }) {
  const { size = "M", onFocus, ...otherProps } = props;
  return (
    <AriaNumberField
      data-size={size}
      {...otherProps}
      onFocus={(event) => {
        onFocus?.(event);
        selectReadOnlyInputOnFocus(event);
      }}
      className={classNames(
        "text-field react-aria-NumberField",
        props.className
      )}
      ref={ref}
      css={css(fieldBaseCSS, textFieldCSS, numberFieldCSS)}
    />
  );
}

export { NumberField };
