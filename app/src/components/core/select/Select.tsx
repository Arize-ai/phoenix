import { css } from "@emotion/react";
import type { Ref } from "react";
import type { SelectProps as AriaSelectProps } from "react-aria-components";
import { Select as AriaSelect } from "react-aria-components";

import { SizeProvider } from "@phoenix/components/core/contexts/SizeContext";
import { selectCSS } from "@phoenix/components/core/select/styles";
import type {
  SizingProps,
  StylableProps,
} from "@phoenix/components/core/types";

import { fieldBaseCSS } from "../field/styles";

export interface SelectProps<
  Item extends object = object,
  SelectionMode extends "single" | "multiple" = "single",
>
  extends AriaSelectProps<Item, SelectionMode>, SizingProps, StylableProps {}

function Select<
  Item extends object,
  SelectionMode extends "single" | "multiple",
>({
  ref,
  ...props
}: SelectProps<Item, SelectionMode> & { ref?: Ref<HTMLDivElement> }) {
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

export { Select };
