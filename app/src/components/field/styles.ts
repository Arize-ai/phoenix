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
    font-size: var(--ac-global-font-size-xs);
    line-height: var(--ac-global-line-height-xs);
    font-weight: var(--px-font-weight-heavy);
  }

  .react-aria-Input,
  .react-aria-TextArea {
    transition: all 0.2s ease-in-out;
    margin: 0;
    flex: 1 1 auto;
    font-size: var(--ac-global-font-size-s);
    min-width: var(--ac-global-input-field-min-width);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    vertical-align: middle;

    &[data-focused] {
      // TODO: figure out focus ring behavior. For now the color is enough
      outline: none;
    }
    &[data-focused]:not([data-invalid]) {
      border: 1px solid var(--ac-global-input-field-border-color-active);
    }
    &[data-hovered]:not([data-disabled]):not([data-invalid]) {
      border: 1px solid var(--ac-global-input-field-border-color-active);
    }
    &[data-disabled] {
      opacity: var(--ac-global-opacity-disabled);
    }
    &[data-invalid="true"] {
      border-color: var(--ac-global-color-danger);
    }
    &::placeholder {
      color: var(--ac-text-color-placeholder);
      font-style: italic;
    }
  }
  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    /* The overriding cascade here is non ideal but it lets us have only one notion of text  */
    font-size: var(--ac-global-font-size-xs) !important;
    padding-top: var(--ac-global-dimension-static-size-50);
    display: inline-block;
    line-height: var(--ac-global-dimension-static-font-size-200) !important;
  }

  [slot="description"] {
    color: var(--ac-global-text-color-500);
  }

  .react-aria-FieldError {
    color: var(--ac-global-color-danger);
  }
`;

export const fieldPopoverCSS = css`
  width: var(--trigger-width);
  background-color: var(--ac-global-menu-background-color);
  border-radius: var(--ac-global-rounding-small);
  color: var(--ac-global-text-color-900);
  box-shadow: 0px 4px 10px var(--px-overlay-shadow-color);
  border: 1px solid var(--ac-global-menu-border-color);
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
    --textfield-input-height: var(--ac-global-input-height-s);
    --textfield-vertical-padding: 6px;
    --textfield-horizontal-padding: 6px;
  }
  &[data-size="M"] {
    --textfield-input-height: var(--ac-global-input-height-m);
    --textfield-vertical-padding: 10px;
    --textfield-horizontal-padding: 10px;
    --icon-size: var(--ac-global-font-size-l);
  }

  &:has(.ac-field-icon) {
    .react-aria-Input {
      padding-right: calc(
        var(--textfield-horizontal-padding) + var(--icon-size)
      );
    }
  }

  /* Icons */
  .ac-field-icon {
    position: absolute;
    right: var(--textfield-horizontal-padding);
    top: var(--field-icon-vertical-position);
  }

  .react-aria-Input,
  .react-aria-TextArea,
  input {
    width: 100%;
    margin: 0;
    border: var(--ac-global-border-size-thin) solid
      var(
        --ac-field-border-color-override,
        var(--ac-global-input-field-border-color)
      );
    border-radius: var(--ac-global-rounding-small);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    padding: var(--textfield-vertical-padding)
      var(--textfield-horizontal-padding);
    box-sizing: border-box;
    outline-offset: -1px;
    outline: var(--ac-global-border-size-thin) solid transparent;
    &[data-focused]:not([data-invalid]) {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
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
