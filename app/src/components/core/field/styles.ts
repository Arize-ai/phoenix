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
    background-color: var(--field-background-color);
    color: var(--field-text-color);
    border: var(--global-border-size-thin) solid var(--field-border-color);
    border-radius: var(--global-rounding-small);
    vertical-align: middle;

    &[data-focused] {
      // State-specific selectors below provide the visible focus treatment.
      outline: none;
    }
    &[data-focused]:not([data-invalid]) {
      border-color: var(--field-border-color-active);
      outline: var(--focus-ring-thickness) solid
        var(--field-border-color-active);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
    &[data-hovered]:not([data-disabled]):not([data-invalid]) {
      border: 1px solid var(--field-border-color-active);
    }
    // Readonly reaches the input as the native \`readonly\` attribute (react-aria
    // does not emit data-readonly on the input), so we can style it directly.
    &:is([data-readonly], [readonly]) {
      background-color: var(--field-readonly-background-color);
      border-color: transparent;
      color: var(--field-readonly-text-color);
    }
    &:is([data-readonly], [readonly])[data-focused]:not([data-invalid]) {
      border-color: transparent;
    }
    &:is([data-readonly], [readonly])[data-focus-visible]:not([data-invalid]) {
      background-color: var(--field-readonly-background-color-hover);
      border-color: var(--field-readonly-border-color-focus);
      outline: var(--focus-ring-thickness) solid
        var(--field-readonly-border-color-focus);
      outline-offset: calc(-1 * var(--focus-ring-thickness));
    }
    &:is([data-readonly], [readonly])[data-hovered]:not([data-invalid]):not(
      [data-focus-visible]
    ) {
      background-color: var(--field-readonly-background-color-hover);
      border-color: transparent;
    }
    &[data-disabled] {
      opacity: var(--global-opacity-disabled);
    }
    &[data-invalid="true"] {
      border: 1px solid var(--field-invalid-border-color);
    }
    &::placeholder {
      color: var(--field-placeholder-color);
      font-style: italic;
    }
  }
  // Give the input a hover affordance when a sibling button (e.g. the copy /
  // reveal button) is interacted with. This depends on the parent field, so it
  // cannot be derived from the input's own state.
  &[data-readonly]:has(button:hover),
  &[data-readonly]:has(button[data-focus-visible]),
  &[data-readonly]:has(button:focus-visible) {
    .react-aria-Input,
    .react-aria-TextArea {
      background-color: var(--field-readonly-background-color-hover);
    }
  }
  [slot="description"],
  [slot="errorMessage"],
  .react-aria-FieldError {
    /* The overriding cascade here is non ideal but it lets us have only one notion of text  */
    font-size: var(--global-font-size-xs) !important;
    padding-top: var(--global-dimension-size-50);
    display: inline-block;
    line-height: var(--global-dimension-font-size-200) !important;
  }

  [slot="description"] {
    color: var(--field-description-text-color);
  }

  .react-aria-FieldError {
    color: var(--field-error-text-color);
  }
`;

export const fieldPopoverCSS = css`
  width: var(--trigger-width);
  background-color: var(--field-popover-background-color);
  border-radius: var(--global-rounding-small);
  color: var(--field-text-color);
  box-shadow: 0px 4px 10px var(--field-popover-shadow-color);
  border: 1px solid var(--field-popover-border-color);
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
      padding-right: calc(
        var(--textfield-horizontal-padding) + var(--icon-size)
      );
    }
  }

  /* Icons */
  .field__icon {
    position: absolute;
    right: var(--textfield-horizontal-padding);
    top: var(--field-icon-vertical-position);
  }

  // Colors, background, border-radius, and the readonly background/border are
  // inherited from fieldBaseCSS (always composed before this). textFieldCSS only
  // layers on sizing and swaps the focus ring from a border to an outline.
  .react-aria-Input,
  .react-aria-TextArea,
  input {
    width: 100%;
    border: var(--global-border-size-thin) solid
      var(--field-border-color-override, var(--field-border-color));
    padding: var(--textfield-vertical-padding)
      var(--textfield-horizontal-padding);
    box-sizing: border-box;
    outline-offset: -1px;
    outline: var(--focus-ring-thickness) solid transparent;
    &[data-focused]:not([data-invalid]) {
      border-width: var(--global-border-size-thin);
      outline: var(--focus-ring-thickness) solid
        var(--field-border-color-active);
    }
    &[data-focused][data-invalid] {
      border-width: var(--global-border-size-thin);
      outline: var(--focus-ring-thickness) solid
        var(--field-invalid-border-color);
    }
    // Suppress the focus outline while readonly (fieldBaseCSS handles the
    // readonly background/border), then restore it only for keyboard focus.
    &:is([data-readonly], [readonly]) {
      outline-color: transparent;
    }
    &:is([data-readonly], [readonly])[data-focused]:not([data-invalid]) {
      outline-color: transparent;
    }
    &:is([data-readonly], [readonly])[data-focus-visible]:not([data-invalid]) {
      border-width: var(--global-border-size-thin);
      outline: var(--focus-ring-thickness) solid
        var(--field-readonly-border-color-focus);
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
