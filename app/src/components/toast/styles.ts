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
  padding: var(--ac-global-dimension-static-size-100)
    var(--ac-global-dimension-static-size-100);
  border-radius: 8px;
  outline: none;
  width: 400px;
  position: relative;
  --toast-border: 1px solid var(--ac-global-border-color-default);
  --toast-background-color: var(--ac-global-background-color-dark);
  --toast-color: var(--ac-global-static-color-900);
  &[data-theme="light"] {
    --toast-border: 1px solid
      lch(from var(--ac-internal-token-color) calc((50 - l) * infinity) 0 0);
    --toast-background-color: var(--ac-internal-token-color);
    --toast-color: lch(
      from var(--ac-internal-token-color) calc((50 - l) * infinity) 0 0
    );
  }
  &[data-theme="dark"] {
    // generate a new dark token bg color from the input color
    --scoped-token-dark-bg: lch(
      from var(--ac-internal-token-color) l c h / calc(alpha - 0.8)
    );
    --toast-border: 1px solid
      lch(from var(--ac-internal-token-color) calc((l) * infinity) c h / 0.3);
    --toast-background-color: var(--scoped-token-dark-bg);
    // generate a new dark token text color from the input color
    --toast-color: lch(
      from var(--scoped-token-dark-bg) calc((l) * infinity) c h / 1
    );
    // because the background may render with transparency, add a blur to improve
    // text readability
    backdrop-filter: blur(4px);
  }
  background: var(--toast-background-color);
  background-color: var(--toast-background-color);
  border: var(--toast-border);
  color: var(--toast-color);

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
      align-items: center;
      color: var(--toast-color);
      font-weight: bold;
      display: flex;
      flex-direction: row;
      gap: var(--ac-global-dimension-static-size-50);
    }

    [slot="description"] {
      color: var(--toast-color);
    }
  }

  .react-aria-Button[slot="close"] {
    flex: 0 0 auto;
    background: none;
    border: none;
    appearance: none;
    border-radius: 50%;
    height: 18px;
    width: 18px;
    border: none;
    color: var(--toast-color);
    padding: 0;
    outline: none;

    &[data-focus-visible] {
      border: 1px solid var(--ac-global-input-field-border-color-active);
      background: var(--toast-background-color);
    }

    &[data-hovered] {
      background: var(--toast-background-color);
    }

    &[data-pressed] {
      background: var(--toast-background-color);
    }
  }
`;
