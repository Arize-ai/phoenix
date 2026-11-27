import { css } from "@emotion/react";

import { fieldPopoverCSS } from "../field/styles";

export const comboBoxCSS = css`
  /* The font size SelectChevronUpDownIcon sets, which is also its width */
  --combobox-chevron-size: 0.8rem;
  &[data-size="M"] {
    --combobox-input-height: var(--global-input-height-s);
    --combobox-vertical-padding: 6px;
    --combobox-start-padding: var(--global-dimension-size-100);
    --combobox-end-padding: var(--global-dimension-size-50);
  }
  &[data-size="L"] {
    --combobox-input-height: var(--global-input-height-m);
    --combobox-vertical-padding: 10px;
    --combobox-start-padding: var(--global-dimension-size-200);
    --combobox-end-padding: var(--global-dimension-size-100);
  }
  color: var(--global-text-color-900);
  &[data-required] {
    .react-aria-Label {
      &::after {
        content: " *";
      }
    }
  }

  .combobox__container {
    display: flex;
    flex-direction: row;
    min-width: 200px;
    position: relative;

    /* The chevron button sits on top of the input, so the input's end padding
       reserves its width. A long value ends in an ellipsis before the chevron
       instead of running under it; focusing the input scrolls to the caret. */
    --combobox-button-width: calc(
      2 * (var(--combobox-end-padding) + 1px) + var(--combobox-chevron-size)
    );

    .react-aria-Input {
      height: var(--combobox-input-height);
      box-sizing: border-box;
      padding: var(--combobox-vertical-padding)
        calc(var(--combobox-button-width) + var(--combobox-end-padding))
        var(--combobox-vertical-padding) var(--combobox-start-padding);
      text-overflow: ellipsis;
    }
    .react-aria-Button {
      /* Account for the border width of the input */
      padding: 0 calc(var(--combobox-end-padding) + 1px);
      background: none;
      color: inherit;
      forced-color-adjust: none;
      position: absolute;
      top: 50%;
      right: 0;
      border: none;
      transform: translateY(-50%);
      cursor: pointer;

      &[data-disabled] {
        opacity: var(--global-opacity-disabled);
      }
    }
  }
`;

export const comboBoxPopoverCSS = css(
  fieldPopoverCSS,
  css`
    .react-aria-ListBox {
      display: block;
      width: unset;
      max-height: inherit;
      min-height: unset;
      border: none;
      overflow: auto;
    }
  `
);

export const comboBoxItemCSS = css`
  outline: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--global-text-color-900);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  font-size: var(--global-dimension-font-size-100);
  cursor: pointer;
  position: relative;
  gap: var(--global-dimension-size-100);
  /* Long items wrap within the popover, which is as wide as the field. They
     prefer the break points the content offers (spaces, hyphens, and the
     identifier separators ComboBoxItem marks) and break between any two
     characters only when a segment is longer than a line. */
  .combobox-item__content {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  & > .icon-wrap.menu-item__selected-checkmark {
    flex: none;
    height: var(--global-dimension-size-200);
    width: var(--global-dimension-size-200);
  }
  &[href] {
    text-decoration: none;
    cursor: pointer;
  }
  &[data-selected] {
    i {
      color: var(--global-color-primary);
    }
  }
  &[data-focused],
  &[data-hovered] {
    background-color: var(--global-menu-item-background-color-hover);
  }

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--global-color-text-30);
  }
  &[data-focus-visible] {
    outline: none;
  }
`;
