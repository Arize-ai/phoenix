import { css } from "@emotion/react";

import { fieldBaseCSS } from "@phoenix/components/field/styles";
export const tagGlobalStylesCSS = css`
  .react-aria-TagGroup {
    ${fieldBaseCSS}
  }

  .react-aria-TagList {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ac-global-dimension-size-50);
    height: 28px;
  }

  .react-aria-Tag {
    color: var(--text-color);
    border: 1px solid var(--ac-global-border-color-dark);
    forced-color-adjust: none;
    border-radius: var(--ac-global-rounding-small);
    padding: var(--ac-global-dimension-size-50)
      var(--ac-global-dimension-size-100);
    font-size: var(--ac-global-font-size-s);
    color: var(--ac-global-text-color-900);
    outline: none;
    cursor: default;
    display: flex;
    align-items: center;
    transition: all 200ms;

    &[data-hovered] {
      border-color: var(--ac-global-border-color-light);
    }

    &[data-focus-visible] {
      outline: 1px solid var(--ac-global-color-primary);
      outline-offset: 1px;
    }

    &[data-selected] {
      border-color: var(--ac-global-color-primary);
      background: var(--ac-global-color-primary-700);
    }
  }
`;
