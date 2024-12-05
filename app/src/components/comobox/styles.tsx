import { css, Theme } from "@emotion/react";

export const comboBoxCSS = (theme: Theme) => css`
  color: var(--ac-global-text-color-900);
  .px-combobox-container {
    position: relative;
    width: fit-content;

    .react-aria-Input {
      transition: all 0.2s ease-in-out;
      margin: 0;
      font-size: var(--px-font-size-med);
      background-color: var(--ac-global-input-field-background-color);
      padding: var(--ac-global-dimension-static-size-50)
        var(--ac-global-dimension-static-size-100);
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
      transform: translateY(-50%);
      right: 0;
      border: none;
      cursor: pointer;
      &[data-disabled] {
        opacity: ${theme.opacity.disabled};
      }
    }
  }
  .react-aria-Label {
    padding: var(--ac-global-dimension-static-size-50) 0;
    display: inline-block;
  }

  .react-aria-FieldError {
    font-size: 12px;
    color: var(--ac-global-color-danger);
  }
  [slot="description"] {
    font-size: 12px;
  }
`;

export const comboBoxPopoverCSS = css`
  width: var(--trigger-width);
  background-color: var(--ac-global-menu-background-color);
  border-radius: var(--ac-global-rounding-small);
  color: var(--ac-global-text-color-900);
  box-shadow: 0px 4px 10px var(--ac-global-color-grey-300);
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
  font-size: var(--px-font-size-med);
  min-width: 80px;
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
