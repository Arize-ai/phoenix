import { css } from "@emotion/react";

/**
 * Base style for all fields (TextField, TextArea, ComboBox, etc.)
 */
export const fieldBaseCSS = css`
  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--ac-global-dimension-static-font-size-75);
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
    &[data-invalid] {
      border-color: var(--ac-global-color-danger);
    }
    &::placeholder {
      color: var(--ac-text-color-placeholder);
      font-style: italic;
    }
  }
  [slot="description"],
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
