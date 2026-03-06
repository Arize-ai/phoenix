import { css } from "@emotion/react";

/**
 * Base style for all fields (TextField, TextArea, ComboBox, etc.)
 */
export const fieldBaseCSS = css`
  &[data-required] {
    .react-aria-Label {
      &::after {
        content: " *";
      }
    }
  }
  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    font-weight: var(--font-weight-heavy);
  }

  .react-aria-Input,
  .react-aria-TextArea {
    transition: all 0.2s ease-in-out;
    margin: 0;
    flex: 1 1 auto;
    font-size: var(--global-font-size-s);
    min-width: var(--global-input-field-min-width);
    background-color: var(--global-input-field-background-color);
    color: var(--global-text-color-900);
    border: var(--global-border-size-thin) solid
      var(--global-input-field-border-color);
    border-radius: var(--global-rounding-small);
    vertical-align: middle;

    &[data-focused] {
      // TODO: figure out focus ring behavior. For now the color is enough
      outline: none;
    }
    &[data-focused]:not([data-invalid]) {
      border: 1px solid var(--global-input-field-border-color-active);
    }
    &[data-hovered]:not([data-disabled]):not([data-invalid]) {
      border: 1px solid var(--global-input-field-border-color-active);
    }
    &[data-disabled] {
      opacity: var(--global-opacity-disabled);
    }
    &[data-invalid="true"] {
      border: 1px solid var(--global-color-danger);
    }
    &::placeholder {
      color: var(--text-color-placeholder);
      font-style: italic;
    }
  }
  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    /* The overriding cascade here is non ideal but it lets us have only one notion of text  */
    font-size: var(--global-font-size-xs) !important;
    padding-top: var(--global-dimension-static-size-50);
    display: inline-block;
    line-height: var(--global-dimension-static-font-size-200) !important;
  }

  [slot="description"] {
    color: var(--global-text-color-500);
  }

  .react-aria-FieldError {
    color: var(--global-color-danger);
  }
`;

export const fieldPopoverCSS = css`
  width: var(--trigger-width);
  background-color: var(--global-menu-background-color);
  border-radius: var(--global-rounding-small);
  color: var(--global-text-color-900);
  box-shadow: 0px 4px 10px var(--overlay-shadow-color);
  border: 1px solid var(--global-menu-border-color);
  max-height: inherit;
`;

export const textFieldCSS = css`
  position: relative;
  width: 100%;
  --field-icon-vertical-position: 50%;

  :has(.react-aria-Label) {
    /* 24px is the height of the label. TODO: make this variable based */
    --field-icon-vertical-position: calc(
      var(--textfield-vertical-padding) + 1px + 24px
    );
  }

  &[data-size="S"] {
    --textfield-input-height: var(--global-input-height-s);
    --textfield-vertical-padding: var(--global-dimension-size-75);
    --textfield-horizontal-padding: var(--global-dimension-size-75);
    --icon-size: var(--global-font-size-s);
  }
  &[data-size="M"] {
    --textfield-input-height: var(--global-input-height-m);
    --textfield-vertical-padding: var(--global-dimension-size-125);
    --textfield-horizontal-padding: var(--global-dimension-size-125);
    --icon-size: var(--global-font-size-m);
  }
  &[data-size="L"] {
    --textfield-input-height: var(--global-input-height-l);
    --textfield-vertical-padding: var(--global-dimension-size-150);
    --textfield-horizontal-padding: var(--global-dimension-size-150);
    --icon-size: var(--global-font-size-l);
  }

  &:has(.field__icon) {
    .react-aria-Input {
      padding-right: calc(var(--textfield-horizontal-padding) + var(--icon-size));
    }
  }

  /* Icons */
  .field__icon {
    position: absolute;
    right: var(--textfield-horizontal-padding);
    top: var(--field-icon-vertical-position);
  }

  .react-aria-Input,
  .react-aria-TextArea,
  input {
    width: 100%;
    margin: 0;
    border: var(--global-border-size-thin) solid
      var(--field-border-color-override, var(--global-input-field-border-color));
    border-radius: var(--global-rounding-small);
    background-color: var(--global-input-field-background-color);
    color: var(--global-text-color-900);
    padding: var(--textfield-vertical-padding) var(--textfield-horizontal-padding);
    box-sizing: border-box;
    outline-offset: -1px;
    outline: var(--global-border-size-thin) solid transparent;
    &[data-focused]:not([data-invalid]) {
      outline: 1px solid var(--global-input-field-border-color-active);
    }
    &[data-focused][data-invalid] {
      outline: 1px solid var(--global-color-danger);
    }
  }

  .react-aria-Input {
    /* TODO: remove this sizing */
    height: var(--textfield-input-height);
  }

  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    grid-area: help;
  }
`;
