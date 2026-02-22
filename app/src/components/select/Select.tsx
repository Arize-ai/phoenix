import { css } from "@emotion/react";
import type { Ref } from "react";
import { forwardRef } from "react";
import type { SelectProps as AriaSelectProps } from "react-aria-components";
import { Select as AriaSelect } from "react-aria-components";

import { selectCSS } from "@phoenix/components/select/styles";
import type { SizingProps, StylableProps } from "@phoenix/components/types";
import { SizeProvider } from "@phoenix/contexts";

import { fieldBaseCSS } from "../field/styles";

export interface SelectProps<
  T extends object = object,
  M extends "single" | "multiple" = "single",
>
  extends AriaSelectProps<T, M>, SizingProps, StylableProps {}

function Select<T extends object, M extends "single" | "multiple">(
  props: SelectProps<T, M>,
  ref: Ref<HTMLDivElement>
) {
  const { size = "M", ...otherProps } = props;
  return (
    <SizeProvider size={size}>
      <AriaSelect
        data-size={size}
        className="select"
        ref={ref}
        css={css(fieldBaseCSS, selectCSS)}
        {...otherProps}
      />
    </SizeProvider>
  );
}

const _Select = forwardRef(Select);

export { _Select as Select };
