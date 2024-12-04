import { css, Theme } from "@emotion/react";

export const comboBoxCSS = css`
  color: var(--ac-global-text-color-900);
  .react-aria-Input {
    margin: 0;
    font-size: 1.072rem;
    background: var(--field-background);
    color: var(--field-text-color);
    border: 1px solid var(--ac-global-border-color-default);
    border-radius: 6px;
    padding: 0.286rem 2rem 0.286rem 0.571rem;
    vertical-align: middle;
    &[data-focused] {
      outline: none;
      outline: 2px solid var(--focus-ring-color);
      outline-offset: -1px;
    }
  }
  .react-aria-Button {
    background: var(--highlight-background);
    color: var(--highlight-foreground);
    forced-color-adjust: none;
    border-radius: 4px;
    border: none;
    padding: var(--ac-global-dimension-size-100);
    align-items: center;
    cursor: pointer;
    &[data-pressed] {
      box-shadow: none;
      background: var(--highlight-background);
    }
  }

  .react-aria-ListBoxItem[href] {
    text-decoration: none;
    cursor: pointer;
  }
  .react-aria-ComboBox {
    .react-aria-Input {
      &[data-disabled] {
        border-color: var(--border-color-disabled);
      }
    }
    .react-aria-Button {
      &[data-disabled] {
        background: var(--border-color-disabled);
      }
    }
    .react-aria-Input {
      &[data-invalid]:not([data-focused]) {
        border-color: var(--invalid-color);
      }
    }
    .react-aria-FieldError {
      font-size: 12px;
      color: var(--invalid-color);
    }
    [slot="description"] {
      font-size: 12px;
    }
  }
`;

export const comboBoxPopoverCSS = css`
  /* .react-aria-Popover[data-trigger="ComboBox"] { */
  width: var(--trigger-width);
  .react-aria-ListBox {
    display: block;
    width: unset;
    max-height: inherit;
    min-height: unset;
    border: none;
    .react-aria-Header {
      padding-left: 1.571rem;
    }
  }
`;

export const comboBoxItemCSS = (theme: Theme) => css`
  outline: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ac-global-text-color-900);
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  font-size: ${theme.typography.sizes.medium.fontSize}px;
  min-width: 80px;
  cursor: pointer;
  position: relative;
  & > .ac-icon-wrap.px-menu-item__selected-checkmark {
    height: var(--ac-global-dimension-static-size-200);
    width: var(--ac-global-dimension-static-size-200);
  }

  /* & > .ac-icon-wrap:first-of-type,
  & > i:first-of-type {
    margin-right: var(--ac-global-dimension-static-size-50);
  } */

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
