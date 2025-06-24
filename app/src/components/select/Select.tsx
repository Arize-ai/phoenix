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

export interface SelectProps
  extends AriaSelectProps,
    SizingProps,
    StylableProps {}

function Select(props: SelectProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <SizeProvider size={size}>
      <AriaSelect
        data-size={size}
        className="ac-select"
        ref={ref}
        {...otherProps}
        css={css(fieldBaseCSS, selectCSS)}
      />
    </SizeProvider>
  );
}

const _Select = forwardRef(Select);

export { _Select as Select };
