import { css } from "@emotion/react";
import type { Ref } from "react";
import type { SearchFieldProps as AriaSearchFieldProps } from "react-aria-components";
import { Button, SearchField as AriaSearchField } from "react-aria-components";

import { Icon, Icons } from "../icon";
import type { BaseVariant, QuietVariant, SizingProps } from "../types";
import { fieldBaseCSS, textFieldCSS } from "./styles";

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
  return <Icon className="search-field__icon" svg={<Icons.Search />} />;
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
    --searchfield-icon-size: var(--global-font-size-s);
  }
  &[data-size="M"] {
    --searchfield-icon-size: var(--global-font-size-m);
  }
  &[data-size="L"] {
    --searchfield-icon-size: var(--global-font-size-l);
  }

  .react-aria-Label {
    grid-area: label;
  }

  .search-field__icon {
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

  .search-field__clear {
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
    color: var(--global-text-color-700);
    border-radius: var(--global-rounding-small);
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    font-size: var(--searchfield-icon-size);

    &[data-focus-visible] {
      outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
      outline-offset: var(--focus-ring-offset);
    }

    &:hover {
      color: var(--global-text-color-900);
      background-color: var(--global-color-gray-300);
    }

    &[data-empty] {
      display: none;
    }
  }

  /*
   * The input's side padding clears the icon on the left and the clear button
   * on the right: inset + icon + gap (gap = inset). It carries !important to
   * beat the size-specific padding the shared text field rules set, so a
   * consumer needing a different inset — a search collapsed to an icon square,
   * a toolbar with its own icon metrics — sets these variables rather than
   * out-shouting the cascade in turn. Left undeclared here so that a value set
   * anywhere above the field wins.
   */
  .search-field__icon ~ .react-aria-Input {
    padding-left: var(
      --searchfield-input-padding-start,
      calc(
        var(--textfield-horizontal-padding) * 2 + var(--searchfield-icon-size)
      )
    ) !important;
  }

  .react-aria-Input {
    padding-right: var(
      --searchfield-input-padding-end,
      calc(
        var(--textfield-horizontal-padding) * 2 + var(--searchfield-icon-size)
      )
    ) !important;
  }

  &[data-invalid="true"] {
    .search-field__icon {
      color: var(--global-color-danger);
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

function SearchField({
  ref,
  ...props
}: SearchFieldProps & { ref?: Ref<HTMLDivElement> }) {
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
      className="search-field"
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
              className="search-field__clear"
              data-empty={renderProps.isEmpty || undefined}
            >
              <Icon svg={<Icons.Close />} />
            </Button>
          )}
        </>
      )}
    </AriaSearchField>
  );
}

export { SearchField };
