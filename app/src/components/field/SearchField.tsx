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

const searchFieldCSS = css`
  --searchfield-icon-left-padding: var(--textfield-horizontal-padding);

  &[data-size="M"] {
    --searchfield-icon-left-padding: calc(
      var(--textfield-horizontal-padding) - 0.4rem
    );
  }

  display: grid;
  grid-template-areas:
    "label label"
    "icon input"
    "help  help";
  grid-template-columns: auto 1fr;
  .react-aria-Label {
    grid-area: label;
  }
  .ac-search-icon {
    grid-area: icon;
    position: absolute;
    left: var(--searchfield-icon-left-padding);
    top: 50%;
    transform: translateY(-50%);
  }
  .react-aria-Input {
    grid-area: input;
    width: 100%;
  }
  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    grid-area: help;
  }

  /* Adjust the padding if there is an icon */
  .ac-search-icon + .react-aria-Input {
    padding-left: calc(
      2 * var(--searchfield-icon-left-padding) + 1rem
    ) !important;
  }

  &[data-invalid="true"] {
    .ac-search-icon {
      color: var(--ac-global-color-danger);
    }
  }
`;
function SearchField(props: SearchFieldProps, ref: Ref<HTMLDivElement>) {
  const { size = "M", ...otherProps } = props;
  return (
    <AriaSearchField
      data-size={size}
      className="ac-searchfield"
      ref={ref}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS, searchFieldCSS)}
    />
  );
}

const _SearchField = forwardRef(SearchField);
export { _SearchField as SearchField };
