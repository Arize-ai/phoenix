import { forwardRef, Ref } from "react";
import {
  Button,
  SearchField as AriaSearchField,
  SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Icon, Icons } from "../icon";
import { BaseVariant, QuietVariant, SizingProps } from "../types";

import { fieldBaseCSS } from "./styles";

import { textFieldCSS } from "./styles";

export interface SearchFieldProps extends AriaSearchFieldProps, SizingProps {
  /**
   * Visual variant of the search field.
   * - "default": Standard bordered input
   * - "quiet": No border, transparent background (inherits from parent)
   */
  variant?: BaseVariant | QuietVariant;
}

/**
 * A search icon styled for use inside SearchField.

 */
export const SearchIcon = () => {
  return <Icon className="ac-search-icon" svg={<Icons.Search />} />;
};

const searchFieldCSS = css`
  display: grid;
  grid-template-areas:
    "label label label"
    "icon input clear"
    "help help help";
  grid-template-columns: auto 1fr auto;
  align-items: center;

  /* Size-specific icon sizes to match TextField sizing */
  &[data-size="S"] {
    --searchfield-icon-size: var(--ac-global-font-size-s);
  }
  &[data-size="M"] {
    --searchfield-icon-size: var(--ac-global-font-size-m);
  }
  &[data-size="L"] {
    --searchfield-icon-size: var(--ac-global-font-size-l);
  }

  .react-aria-Label {
    grid-area: label;
  }

  .ac-search-icon {
    grid-area: icon;
    position: absolute;
    left: var(--textfield-horizontal-padding);
    top: 50%;
    transform: translateY(-50%);
    font-size: var(--searchfield-icon-size);
  }

  .react-aria-Input {
    grid-area: input;
    width: 100%;

    /* Hide browser native clear button since we have a custom one */
    &::-webkit-search-cancel-button,
    &::-webkit-search-decoration {
      -webkit-appearance: none;
      appearance: none;
      display: none;
    }
  }

  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    grid-area: help;
  }

  .ac-searchfield-clear {
    grid-area: clear;
    position: absolute;
    /* account for clear button size */
    right: calc(var(--textfield-horizontal-padding) - 2px);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 2px;
    cursor: pointer;
    color: var(--ac-global-text-color-700);
    border-radius: var(--ac-global-rounding-small);
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    font-size: var(--searchfield-icon-size);

    &[data-focus-visible] {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
      outline-offset: 1px;
    }

    &:hover {
      color: var(--ac-global-text-color-900);
      background-color: var(--ac-global-color-grey-300);
    }

    &[data-empty] {
      display: none;
    }
  }

  /* Left padding when icon present: inset + icon + gap (gap = inset) */
  .ac-search-icon ~ .react-aria-Input {
    padding-left: calc(
      var(--textfield-horizontal-padding) * 2 + var(--searchfield-icon-size)
    ) !important;
  }

  /* Right padding for clear button: inset + icon + gap */
  .react-aria-Input {
    padding-right: calc(
      var(--textfield-horizontal-padding) * 2 + var(--searchfield-icon-size)
    ) !important;
  }

  &[data-invalid="true"] {
    .ac-search-icon {
      color: var(--ac-global-color-danger);
    }
  }

  &[data-variant="quiet"] {
    .react-aria-Input {
      background-color: transparent;
      border-color: transparent;
      border-radius: 0;
      outline: none;
    }

    .react-aria-Input[data-hovered]:not([data-disabled]):not([data-invalid]) {
      border-color: transparent;
    }

    .react-aria-Input[data-focused] {
      border-color: transparent;
      outline: none;
    }
  }
`;

function SearchField(props: SearchFieldProps, ref: Ref<HTMLDivElement>) {
  const {
    size = "M",
    variant = "default",
    children,
    isReadOnly,
    ...otherProps
  } = props;
  return (
    <AriaSearchField
      data-size={size}
      data-variant={variant}
      className="ac-searchfield"
      ref={ref}
      isReadOnly={isReadOnly}
      {...otherProps}
      css={css(fieldBaseCSS, textFieldCSS, searchFieldCSS)}
    >
      {(renderProps) => (
        <>
          {typeof children === "function" ? children(renderProps) : children}
          {!isReadOnly && (
            <Button
              slot="clear"
              className="ac-searchfield-clear"
              data-empty={renderProps.isEmpty || undefined}
            >
              <Icon svg={<Icons.CloseOutline />} />
            </Button>
          )}
        </>
      )}
    </AriaSearchField>
  );
}

const _SearchField = forwardRef(SearchField);
export { _SearchField as SearchField };
