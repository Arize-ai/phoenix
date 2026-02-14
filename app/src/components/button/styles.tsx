import { css } from "@emotion/react";

export const buttonCSS = css`
  --button-border-color: var(--global-input-field-border-color);
  border: 1px solid var(--button-border-color);
  font-size: var(--global-dimension-static-font-size-100);
  line-height: 20px; // TODO(mikeldking): move this into a consistent variable
  margin: 0;
  flex: none;

  display: flex;
  gap: var(--global-dimension-static-size-100);
  justify-content: center;
  align-items: center;
  flex-direction: row;
  box-sizing: border-box;
  border-radius: var(--global-rounding-small);
  color: var(--global-text-color-900);
  transition: background-color 0.2s ease-in-out;
  cursor: pointer;

  /* Disable outline since there are other mechanisms to show focus */
  outline: none;
  &[data-focus-visible] {
    // Only show outline on focus-visible, aka only when tabbed but not clicked
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 1px;
  }
  &[disabled] {
    cursor: default;
    opacity: var(--global-opacity-disabled);
  }
  &[data-size="S"] {
    height: var(--global-button-height-s);
  }
  &[data-size="M"] {
    height: var(--global-button-height-m);
  }
  &[data-size="M"][data-childless="false"] {
    padding: var(--global-dimension-static-size-100)
      var(--global-dimension-static-size-200);
  }
  &[data-size="S"][data-childless="false"] {
    padding: var(--global-dimension-static-size-50)
      var(--global-dimension-static-size-100);
  }
  &[data-size="M"][data-childless="true"] {
    padding: var(--global-dimension-static-size-100)
      var(--global-dimension-static-size-100);
  }
  &[data-size="S"][data-childless="true"] {
    padding: var(--global-dimension-static-size-50)
      var(--global-dimension-static-size-50);
  }
  // The default style

  background-color: var(--global-input-field-background-color);
  border-color: var(--button-border-color);
  &:hover:not([disabled]) {
    background-color: var(--global-input-field-background-color-hover);
  }

  &[data-variant="primary"] {
    background-color: var(--global-button-primary-background-color);
    --button-border-color: var(--global-button-primary-border-color);
    color: var(--global-button-primary-foreground-color);
    &:hover:not([disabled]) {
      background-color: var(--global-button-primary-background-color-hover);
    }
  }
  &[data-variant="danger"] {
    background-color: var(--global-button-danger-background-color);
    --button-border-color: var(--global-button-danger-border-color);
    color: var(--global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--global-button-danger-background-color-hover);
    }
  }
  &[data-variant="success"] {
    background-color: var(--global-button-success-background-color);
    --button-border-color: var(--global-button-success-border-color);
    color: var(--global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--global-button-success-background-color-hover);
    }
  }
  &[data-variant="quiet"] {
    background-color: transparent;
    --button-border-color: transparent;
    &:hover:not([disabled]) {
      border-color: transparent;
      background-color: var(--global-input-field-background-color-active);
    }
  }

  kbd {
    background-color: var(--global-color-grey-400);
    border-radius: var(--global-rounding-small);
    padding: var(--global-dimension-size-50)
      var(--global-dimension-size-75);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-font-size-xxs);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--global-dimension-static-size-25);
    text-transform: uppercase;
  }

  &[data-variant="primary"] {
    kbd {
      background-color: var(--global-color-grey-700);
    }
  }
`;
