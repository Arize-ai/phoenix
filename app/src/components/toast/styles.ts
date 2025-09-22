import { css } from "@emotion/react";

export const toastRegionCss = css`
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  border-radius: 8px;
  outline: none;
`;

export const toastCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-static-size-100);
  background: slateblue;
  color: white;
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-200);
  border-radius: 8px;
  outline: none;
  width: 400px;
  --toast-border: 1px solid var(--ac-global-border-color-default);
  --toast-background-color: var(--ac-global-background-color-dark);
  --toast-color: var(--ac-global-static-color-900);
  border: var(--toast-border);
  background-color: var(--toast-background-color);
  color: var(--toast-color);

  &[data-variant="success"] {
    --toast-border: 1px solid var(--ac-global-color-success);
    --toast-background-color: var(--ac-global-color-success-700);
    --toast-color: var(--ac-global-static-color-white-900);
  }

  &[data-variant="error"] {
    --toast-border: 1px solid var(--ac-global-color-danger);
    --toast-background-color: var(--ac-global-color-danger-700);
    --toast-color: var(--ac-global-static-color-white-900);
  }

  &[data-focus-visible] {
    outline: 2px solid slateblue;
    outline-offset: 2px;
  }

  .toast-action-container {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
  }

  .toast-action-button {
    background: transparent;
    border: var(--toast-border);
    color: var(--toast-color);
    outline: none;
    backdrop-filter: blur(10px);

    &:hover,
    &:focus-visible,
    &:active {
      background: var(--toast-background-color);
      background-color: var(--toast-background-color);
    }
  }

  .react-aria-ToastContent {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0px;

    [slot="title"] {
      font-weight: bold;
      display: flex;
      flex-direction: row;
      gap: var(--ac-global-dimension-static-size-50);
    }
  }

  .react-aria-Button[slot="close"] {
    flex: 0 0 auto;
    background: none;
    border: none;
    appearance: none;
    border-radius: 50%;
    height: 20px;
    width: 20px;
    font-size: 16px;
    border: none;
    color: var(--ac-global-static-color-white-900);
    padding: 0;
    outline: none;

    &[data-focus-visible] {
      border: 1px solid var(--ac-global-input-field-border-color-active);
    }

    &[data-pressed] {
      background: var(--toast-background-color);
    }
  }
`;
