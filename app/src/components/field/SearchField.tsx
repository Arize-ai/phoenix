import { forwardRef, Ref } from "react";
import {
  Button,
  SearchField as AriaSearchField,
  SearchFieldProps as AriaSearchFieldProps,
} from "react-aria-components";
import { css } from "@emotion/react";

import { Icon, Icons } from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/field/styles";
import { SizingProps } from "@phoenix/components/types";

import { textFieldCSS } from "./styles";

export interface SearchFieldProps extends AriaSearchFieldProps, SizingProps {
  /**
   * Visual variant of the search field.
   * - "default": Standard bordered input
   * - "quiet": No border, transparent background (inherits from parent)
   */
  variant?: "default" | "quiet";
  /**
   * Whether to show the search icon. Defaults to true.
   */
  showIcon?: boolean;
}

const searchFieldCSS = css`
  --searchfield-icon-size: 1rem;

  display: grid;
  grid-template-areas:
    "label label label"
    "icon input clear"
    "help help help";
  grid-template-columns: auto 1fr auto;
  align-items: center;

  .react-aria-Label {
    grid-area: label;
  }

  .ac-search-icon {
    grid-area: icon;
    position: absolute;
    left: var(--textfield-horizontal-padding);
    top: 50%;
    transform: translateY(-50%);
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
      border-top: none;
      border-left: none;
      border-right: none;
      border-bottom: 1px solid var(--ac-global-input-field-border-color);
      border-radius: 0;
      outline: none;
    }

    /* Hover: use text color for more visibility */
    .react-aria-Input[data-hovered]:not([data-disabled]):not([data-invalid]) {
      border-top: none;
      border-left: none;
      border-right: none;
      border-bottom: 1px solid var(--ac-global-text-color-700);
    }

    /* Focus: active color */
    .react-aria-Input[data-focused] {
      border-top: none;
      border-left: none;
      border-right: none;
      border-bottom: 1px solid var(--ac-global-input-field-border-color-active);
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
    showIcon = true,
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
          {showIcon && (
            <Icon className="ac-search-icon" svg={<Icons.Search />} />
          )}
          {typeof children === "function" ? children(renderProps) : children}
          {!isReadOnly && (
            <Button
              className="ac-searchfield-clear"
              data-empty={!renderProps.state.value || undefined}
              aria-label="Clear search"
              excludeFromTabOrder={false}
              onPress={() => renderProps.state.setValue("")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  renderProps.state.setValue("");
                }
              }}
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
