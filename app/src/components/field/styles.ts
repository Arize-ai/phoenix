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

  .react-aria-Input {
    transition: all 0.2s ease-in-out;
    margin: 0;
    flex: 1 1 auto;
    min-width: var(--ac-global-input-field-min-width);
    background-color: var(--ac-global-input-field-background-color);
    color: var(--ac-global-text-color-900);
    border: var(--ac-global-border-size-thin) solid
      var(--ac-global-input-field-border-color);
    border-radius: var(--ac-global-rounding-small);
    vertical-align: middle;

    &[data-focused] {
      outline: none;
      border: 1px solid var(--ac-global-input-field-border-color-active);
    }
    &[data-hovered]:not([data-disabled]) {
      border: 1px solid var(--ac-global-input-field-border-color-active);
    }
    &[data-disabled] {
      opacity: var(--ac-global-opacity-disabled);
    }
    &[data-invalid]:not([data-focused]) {
      border-color: var(--ac-global-color-danger);
    }
  }
  [slot="description"] {
    font-size: var(--ac-global-font-size-xs);
    padding-top: var(--ac-global-dimension-static-size-50);
    display: inline-block;
    color: var(--ac-global-text-color-500);
    line-height: var(--ac-global-dimension-static-font-size-200);
  }
`;