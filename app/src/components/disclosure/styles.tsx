import { css } from "@emotion/react";

export const disclosureGroupCss = css`
  & > * {
    width: 100%;
    .react-aria-Heading {
      width: 100%;
      .react-aria-Button[slot="trigger"] {
        width: 100%;
      }
    }
  }
`;

export const disclosureCss = css`
  .react-aria-Heading {
    margin: 0;
  }

  .react-aria-Button[slot="trigger"] {
    // reset trigger styles
    background: none;
    border: none;
    box-shadow: none;
    font-size: 16px;
    font-weight: 400;
    line-height: 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: var(--ac-global-dimension-static-size-100)
      var(--ac-global-dimension-static-size-100);

    // style trigger
    color: var(--ac-global-text-color-900);
    border-bottom: 1px solid var(--ac-global-border-color-default);
    outline: none;

    background-color: transparent;
    &:hover:not([disabled]),
    &:focus:not([disabled]) {
      background-color: var(--ac-global-input-field-background-color-active);
    }
    &:not([disabled]) {
      transition: all 0.2s ease-in-out;
    }
    &[disabled] {
      cursor: default;
      opacity: 0.6;
    }

    // style trigger icon
    svg,
    i {
      rotate: 0deg;
      transition: rotate 200ms;
      width: 1em;
      height: 1em;
      fill: currentColor;
    }
  }

  &[data-expanded] .react-aria-Button[slot="trigger"] svg,
  &[data-expanded] .react-aria-Button[slot="trigger"] i {
    rotate: 45deg;
  }
`;
