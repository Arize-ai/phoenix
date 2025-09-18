import { css } from "@emotion/react";

export const checkboxCSS = css`
  --selected-color: var(--ac-global-color-grey-800);
  --selected-color-pressed: var(--ac-global-color-grey-900);
  --checkmark-color: var(--ac-global-color-grey-50);
  --border-color: var(--ac-global-color-grey-300);
  --border-color-pressed: var(--ac-global-color-grey-400);
  --focus-ring-color: var(--ac-focus-ring-color);

  display: flex;
  /* This is needed so the HiddenInput is positioned correctly */
  position: relative;
  align-items: center;
  gap: 0.571rem;
  font-size: 1.143rem;
  forced-color-adjust: none;

  .checkbox {
    width: 1.143rem;
    height: 1.143rem;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    transition: all 200ms;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: var(--checkmark-color);
    stroke-width: 3px;
    stroke-dasharray: 22px;
    stroke-dashoffset: 66;
    transition: all 200ms;
  }

  &[data-pressed] .checkbox {
    border-color: var(--border-color-pressed);
  }

  &[data-focus-visible] .checkbox {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }

  &[data-selected],
  &[data-indeterminate] {
    .checkbox {
      border-color: var(--selected-color);
      background: var(--selected-color);
    }

    &[data-pressed] .checkbox {
      border-color: var(--selected-color-pressed);
      background: var(--selected-color-pressed);
    }

    svg {
      stroke-dashoffset: 44;
    }
  }

  &[data-indeterminate] {
    & svg {
      stroke: none;
      fill: var(--checkmark-color);
    }
  }
`;
