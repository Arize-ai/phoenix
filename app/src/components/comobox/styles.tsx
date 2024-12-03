import { css } from "@emotion/react";

export const comboBoxCSS = css`
  .react-aria-ComboBox {
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
      margin-left: -1.714rem;
      width: 1.429rem;
      height: 1.429rem;
      padding: 0;
      font-size: 0.857rem;
      cursor: default;
      &[data-pressed] {
        box-shadow: none;
        background: var(--highlight-background);
      }
    }
  }
  .react-aria-Popover[data-trigger="ComboBox"] {
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
    .react-aria-ListBoxItem {
      padding: 0.286rem 0.571rem 0.286rem 1.571rem;
      &[data-focus-visible] {
        outline: none;
      }
      &[data-selected] {
        font-weight: 600;
        background: unset;
        color: var(--text-color);
        &::before {
          content: "✓";
          content: "✓" / "";
          alt: " ";
          position: absolute;
          top: 4px;
          left: 4px;
        }
      }
      &[data-focused],
      &[data-pressed] {
        background: var(--ac-highlight-background-color);
        color: var(--ac-highlight-foreground-color);
      }
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
