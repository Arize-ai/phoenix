import { forwardRef, Ref } from "react";
import {
  SearchField as AriaSearchField,
  SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";

import { textFieldCSS } from "./styles";
export interface SearchFieldProps extends AriaSearchFieldProps, SizingProps {}

function SearchField(props: SearchFieldProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaSearchField
      data-size={size}
      className="ac-searchfield"
      ref={ref}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS)}
    />
  );
}

const _SearchField = forwardRef(SearchField);
export { _SearchField as SearchField };
