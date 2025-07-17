import { css } from "@emotion/react";

export const buttonCSS = css`
  --button-border-color: var(--ac-global-input-field-border-color);
  border: 1px solid var(--button-border-color);
  font-size: var(--ac-global-dimension-static-font-size-100);
  line-height: 20px; // TODO(mikeldking): move this into a consistent variable
  margin: 0;

  display: flex;
  gap: var(--ac-global-dimension-static-size-100);
  justify-content: center;
  align-items: center;
  flex-direction: row;
  box-sizing: border-box;
  border-radius: var(--ac-global-rounding-small);
  color: var(--ac-global-text-color-900);
  transition: background-color 0.2s ease-in-out;
  cursor: pointer;

  /* Disable outline since there are other mechanisms to show focus */
  outline: none;
  &[data-focus-visible] {
    // Only show outline on focus-visible, aka only when tabbed but not clicked
    outline: 1px solid var(--ac-global-input-field-border-color-active);
    outline-offset: 1px;
  }
  &[disabled] {
    cursor: default;
    opacity: var(--ac-opacity-disabled);
  }
  &[data-size="M"][data-childless="false"] {
    padding: var(--ac-global-dimension-static-size-100)
      var(--ac-global-dimension-static-size-200);
  }
  &[data-size="S"][data-childless="false"] {
    padding: var(--ac-global-dimension-static-size-50)
      var(--ac-global-dimension-static-size-100);
  }
  &[data-size="M"][data-childless="true"] {
    padding: var(--ac-global-dimension-static-size-100)
      var(--ac-global-dimension-static-size-100);
  }
  &[data-size="S"][data-childless="true"] {
    padding: var(--ac-global-dimension-static-size-50)
      var(--ac-global-dimension-static-size-50);
  }
  // The default style

  background-color: var(--ac-global-input-field-background-color);
  border-color: var(--button-border-color);
  &:hover:not([disabled]) {
    background-color: var(--ac-global-input-field-border-color-hover);
  }

  &[data-variant="primary"] {
    background-color: var(--ac-global-button-primary-background-color);
    --button-border-color: var(--ac-global-button-primary-border-color);
    color: var(--ac-global-button-primary-foreground-color);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-primary-background-color-hover);
    }
  }
  &[data-variant="danger"] {
    background-color: var(--ac-global-button-danger-background-color);
    --button-border-color: var(--ac-global-button-danger-border-color);
    color: var(--ac-global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-danger-background-color-hover);
    }
  }
  &[data-variant="success"] {
    background-color: var(--ac-global-button-success-background-color);
    --button-border-color: var(--ac-global-button-success-border-color);
    color: var(--ac-global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-success-background-color-hover);
    }
  }
  &[data-variant="quiet"] {
    background-color: transparent;
    --button-border-color: transparent;
    &:hover:not([disabled]) {
      border-color: transparent;
      background-color: var(--ac-global-input-field-background-color-active);
    }
  }

  kbd {
    background-color: var(--ac-global-color-grey-400);
    border-radius: var(--ac-global-rounding-small);
    padding: var(--ac-global-dimension-size-50)
      var(--ac-global-dimension-size-75);
    font-size: var(--ac-global-font-size-xs);
    line-height: var(--ac-global-font-size-xxs);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--ac-global-dimension-static-size-25);
    text-transform: uppercase;
  }

  &[data-variant="primary"] {
    kbd {
      background-color: var(--ac-global-color-grey-700);
    }
  }
`;
