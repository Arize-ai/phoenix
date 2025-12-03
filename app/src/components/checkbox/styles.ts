import { css } from "@emotion/react";

export const checkboxCSS = css`
  --selected-color: var(--ac-global-checkbox-selected-color);
  --selected-color-pressed: var(--ac-global-checkbox-selected-color-pressed);
  --checkmark-color: var(--ac-global-checkbox-checkmark-color);
  --border-color: var(--ac-global-checkbox-border-color);
  --border-color-pressed: var(--ac-global-checkbox-border-color-pressed);
  --border-color-hover: var(--ac-global-checkbox-border-color-hover);
  --focus-ring-color: var(--ac-focus-ring-color);
  --checkbox-size: var(--ac-global-dimension-static-size-200);

  display: flex;
  /* This is needed so the HiddenInput is positioned correctly */
  position: relative;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  forced-color-adjust: none;
  cursor: pointer;

  .checkbox {
    box-sizing: border-box;
    width: var(--checkbox-size);
    height: var(--checkbox-size);
    border: 2px solid var(--border-color);
    border-radius: var(--ac-global-rounding-small);
    transition: all 200ms;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .checkbox svg {
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

  &[data-force-hovered],
  &[data-hovered] {
    .checkbox {
      border-color: var(--border-color-hover);
    }
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

    .checkbox svg {
      stroke-dashoffset: 44;
    }
  }

  &[data-indeterminate] {
    & .checkbox svg {
      stroke: none;
      fill: var(--checkmark-color);
    }
  }

  &[data-disabled] {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;
