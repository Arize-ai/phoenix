import { css } from "@emotion/react";

export const buttonCSS = css`
  border: 1px solid var(--ac-global-border-color-default);
  font-size: var(--ac-global-dimension-static-font-size-100);
  line-height: 20px; // TODO(mikeldking): move this into a consistent variable
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  border-radius: var(--ac-global-rounding-small);
  color: var(--ac-global-text-color-900);
  cursor: pointer;
  /* Disable outline since there are other mechanisms to show focus */
  outline: none;
  &:not([disabled]) {
    transition: all 0.2s ease-in-out;
  }
  &[disabled] {
    cursor: default;
    opacity: 0.6;
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
  &[data-variant="primary"] {
    background-color: var(--ac-global-button-primary-background-color);
    border-color: var(--ac-global-button-primary-border-color);
    color: var(--ac-global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-primary-background-color-hover);
    }
  }
  &[data-variant="danger"] {
    background-color: var(--ac-global-button-danger-background-color);
    border-color: var(--ac-global-button-danger-border-color);
    color: var(--ac-global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-danger-background-color-hover);
    }
  }
  &[data-variant="success"] {
    background-color: var(--ac-global-button-success-background-color);
    border-color: var(--ac-global-button-success-border-color);
    color: var(--ac-global-static-color-white-900);
    color: var(--ac-global-static-color-white-900);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-button-success-background-color-hover);
    }
  }
  &[data-variant="default"] {
    background-color: var(--ac-global-input-field-background-color);
    border-color: var(--ac-global-input-field-border-color);
    &:hover:not([disabled]) {
      background-color: var(--ac-global-input-field-border-color-hover);
    }
  }
  &[data-variant="quiet"] {
    background-color: transparent;
    border-color: transparent;
    &:hover:not([disabled]) {
      border-color: transparent;
      background-color: var(--ac-global-input-field-background-color-active);
    }
  }

  &[data-childless="false"] > i,
  & > .ac-spinner {
    margin-right: var(--ac-global-dimension-static-size-50);
  }
`;
