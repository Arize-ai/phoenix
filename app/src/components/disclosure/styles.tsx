import { css } from "@emotion/react";

export const disclosureGroupCSS = css`
  & > * {
    width: 100%;
    .react-aria-Heading {
      width: 100%;
      .react-aria-Button[slot="trigger"] {
        width: 100%;
      }
    }
  }

  // add border between items, only when child is expanded
  > .ac-disclosure:not(:last-child) {
    &[data-expanded="true"] {
      border-bottom: 1px solid var(--ac-global-border-color-default);
    }
  }

  &[data-size="S"] > * {
    .react-aria-Heading {
      .react-aria-Button[slot="trigger"] {
        padding: var(--ac-global-dimension-static-size-50);
      }
    }
  }
`;

export const disclosureCSS = css`
  .react-aria-Heading {
    margin: 0;
  }

  [slot="trigger"] {
    // reset trigger styles
    background: none;
    border: none;
    box-shadow: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: var(--ac-global-font-size-s);
    line-height: var(--ac-global-line-height-s);
    padding: var(--ac-global-dimension-static-size-100)
      var(--ac-global-dimension-static-size-200);

    // style trigger
    color: var(--ac-global-text-color-900);
    border-bottom: 1px solid var(--ac-global-border-color-default);
    outline: none;
    background-color: transparent;
    &:hover:not([disabled]) {
      background-color: var(--ac-global-disclosure-background-color-active);
    }
    &[data-focus-visible] {
      outline: 1px solid var(--ac-global-input-field-border-color-active);
      outline-offset: -1px;
    }
    &:not([disabled]) {
      transition: all 0.2s ease-in-out;
    }
    &[disabled] {
      cursor: default;
      opacity: 0.6;
    }

    // style trigger icon
    > svg,
    > i {
      rotate: 90deg;
      transition: rotate 200ms;
      width: 1em;
      height: 1em;
      fill: currentColor;
    }

    &[data-arrow-position="start"] {
      flex-direction: row-reverse;
      > svg,
      > i {
        rotate: 0deg;
      }
    }
  }

  &[data-size="L"] .react-aria-Button[slot="trigger"] {
    height: 48px;
    max-height: 48px;
  }

  &[data-expanded] .react-aria-Button[slot="trigger"] {
    > svg,
    > i {
      rotate: -90deg;
    }

    &[data-arrow-position="start"] {
      > svg,
      > i {
        rotate: 90deg;
      }
    }
  }
`;
