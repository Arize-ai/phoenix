import { forwardRef, Ref } from "react";
import {
  Select as AriaSelect,
  SelectProps as AriaSelectProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { selectCSS } from "@phoenix/components/select/styles";
import { SizingProps, StylableProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts";

import { fieldBaseCSS } from "../field/styles";

export interface SelectProps<T extends object, M extends "single" | "multiple">
  extends AriaSelectProps<T, M>,
    SizingProps,
    StylableProps {}

function Select<T extends object, M extends "single" | "multiple">(
  props: SelectProps<T, M>,
  ref: Ref<HTMLDivElement>
) {
  const { size = "M", ...otherProps } = props;
  return (
    <SizeProvider size={size}>
      <AriaSelect
        data-size={size}
        className="ac-select"
        ref={ref}
        css={css(fieldBaseCSS, selectCSS)}
        {...otherProps}
      />
    </SizeProvider>
  );
}

const _Select = forwardRef(Select);

export { _Select as Select };
