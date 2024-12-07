import { css, Theme } from "@emotion/react";

export const comboBoxCSS = (theme: Theme) => css`
  &[data-size="M"] {
    --combobox-vertical-padding: 6px;
    --combobox-horizontal-padding: 6px;
  }
  &[data-size="L"] {
    --combobox-vertical-padding: 10px;
    --combobox-horizontal-padding: var(--ac-global-dimension-static-size-200);
  }
  color: var(--ac-global-text-color-900);
  &[data-required] {
    .react-aria-Label {
      &::after {
        content: " *";
      }
    }
  }

  .px-combobox-container {
    display: flex;
    flex-direction: row;
    width: fit-content;
    min-width: 200px;
    position: relative;

    .react-aria-Input {
      transition: all 0.2s ease-in-out;
      margin: 0;
      flex: 1 1 auto;
      font-size: var(--ac-global-dimension-static-font-size-100);
      background-color: var(--ac-global-input-field-background-color);
      padding: var(--combobox-vertical-padding)
        var(--combobox-horizontal-padding);
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
        opacity: ${theme.opacity.disabled};
      }
      &[data-invalid]:not([data-focused]) {
        border-color: var(--ac-global-color-danger);
      }
    }
    .react-aria-Button {
      background: none;
      color: inherit;
      forced-color-adjust: none;
      position: absolute;
      top: 50%;
      right: 0;
      border: none;
      transform: translateY(-50%);
      cursor: pointer;
      padding: 0 10px;
      &[data-disabled] {
        opacity: ${theme.opacity.disabled};
      }
      i {
        font-size: var(--ac-global-dimension-static-font-size-200);
      }
    }
  }
  .react-aria-Label {
    padding: 5px 0;
    display: inline-block;
    font-size: var(--ac-global-dimension-static-font-size-75);
    font-weight: var(--px-font-weight-heavy);
  }

  .react-aria-FieldError {
    font-size: var(--ac-global-dimension-static-font-size-75);
    font-size: 12px;
    color: var(--ac-global-color-danger);
  }
  [slot="description"] {
    font-size: var(--ac-global-dimension-static-font-size-75);
    padding-top: var(--ac-global-dimension-static-size-50);
    display: inline-block;
    color: var(--ac-global-text-color-500);
    line-height: var(--ac-global-dimension-static-font-size-200);
  }
`;

export const comboBoxPopoverCSS = css`
  width: var(--trigger-width);
  background-color: var(--ac-global-menu-background-color);
  border-radius: var(--ac-global-rounding-small);
  color: var(--ac-global-text-color-900);
  box-shadow: 0px 4px 10px var(--px-overlay-shadow-color);
  border: 1px solid var(--ac-global-menu-border-color);
  max-height: inherit;
  .react-aria-ListBox {
    display: block;
    width: unset;
    max-height: inherit;
    min-height: unset;
    border: none;
  }
`;

export const comboBoxItemCSS = css`
  outline: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ac-global-text-color-900);
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  font-size: var(--ac-global-dimension-static-font-size-100);
  cursor: pointer;
  position: relative;
  & > .ac-icon-wrap.px-menu-item__selected-checkmark {
    height: var(--ac-global-dimension-static-size-200);
    width: var(--ac-global-dimension-static-size-200);
  }
  &[href] {
    text-decoration: none;
    cursor: pointer;
  }
  &[data-selected] {
    i {
      color: var(--ac-global-color-primary);
    }
  }
  &[data-focused],
  &[data-hovered] {
    background-color: var(--ac-global-menu-item-background-color-hover);
  }

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--ac-global-color-text-30);
  }
  &[data-focus-visible] {
    outline: none;
  }
`;
