import { css } from "@emotion/react";

export const elicitationCarouselCSS = css`
  display: flex;
  flex-direction: column;

  .elicitation__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--global-dimension-size-150) var(--global-dimension-size-200)
      var(--global-dimension-size-50);
  }

  .elicitation__step-label {
    font-size: var(--global-font-size-xxs);
    font-weight: 600;
    color: var(--global-text-color-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .elicitation__dots {
    display: flex;
    gap: var(--global-dimension-size-75);
  }

  .elicitation__dot {
    width: 8px;
    height: 8px;
    border-radius: var(--global-rounding-full);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: background-color 0.2s ease;
  }

  .elicitation__dot--active {
    background-color: var(--global-text-color-900);
  }

  .elicitation__dot--inactive {
    background-color: var(--global-text-color-300);
  }

  .elicitation__body {
    position: relative;
    overflow: hidden;
  }

  .elicitation__question-content {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200)
      var(--global-dimension-size-150);
  }

  .elicitation__prompt {
    font-size: var(--global-font-size-s);
    font-weight: 500;
    color: var(--global-text-color-900);
    margin-bottom: var(--global-dimension-size-150);
    line-height: var(--global-line-height-s);
  }

  .elicitation__options {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
  }

  .elicitation__freeform {
    width: 100%;
    min-height: 100px;
    background: transparent;
    color: var(--global-text-color-900);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    border-radius: var(--global-rounding-medium);
    outline: none;
    resize: none;
    padding: var(--global-dimension-size-125) var(--global-dimension-size-150);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    line-height: var(--global-line-height-s);
    box-sizing: border-box;
    transition: border-color 0.15s ease;

    &::placeholder {
      color: var(--global-text-color-300);
    }

    &:focus {
      border-color: var(--global-color-primary);
    }
  }

  .elicitation__nav {
    display: flex;
    justify-content: space-between;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-200)
      var(--global-dimension-size-150);
  }

  .elicitation__nav-group {
    display: flex;
    gap: var(--global-dimension-size-100);
  }

  .elicitation__nav .react-aria-Button {
    font-size: var(--global-font-size-xs);
  }
`;

export const elicitationOptionButtonCSS = css`
  display: flex;
  align-items: flex-start;
  gap: var(--global-dimension-size-125);
  width: 100%;
  padding: var(--global-dimension-size-125) var(--global-dimension-size-150);
  border: var(--global-border-size-thin) solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  cursor: pointer;
  font-size: var(--global-font-size-s);
  font-family: inherit;
  text-align: left;
  box-sizing: border-box;
  background: transparent;
  color: var(--global-text-color-500);

  .theme--light & {
    color: var(--global-text-color-600);
  }

  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;

  &:focus-visible {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 1px;
  }

  &[data-selected="true"] {
    background: rgba(var(--global-color-gray-900-rgb), 0.06);
    border-color: var(--global-text-color-700);
    color: var(--global-text-color-900);

    .theme--light & {
      background: var(--global-color-gray-75);
      border-color: var(--global-color-gray-600);
    }
  }

  .option-button__indicator {
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
    transition: all 200ms;
  }

  .option-button__indicator--radio {
    border-radius: 50%;
    border: 2px solid var(--global-input-field-border-color);
    background: var(--global-input-field-background-color);
  }

  .option-button__indicator--checkbox {
    width: 16px;
    height: 16px;
    border-radius: var(--global-rounding-small);
    border: 2px solid var(--global-checkbox-border-color);
    background: transparent;
  }

  .option-button__indicator--checkbox svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: var(--global-checkbox-checkmark-color);
    stroke-width: 3px;
    stroke-dasharray: 22px;
    stroke-dashoffset: 66;
    transition: all 200ms;
  }

  &[data-selected="true"] .option-button__indicator--radio {
    border-color: var(--global-button-primary-background-color);
    border-width: 6px;
  }

  &[data-selected="true"] .option-button__indicator--checkbox {
    border-color: var(--global-checkbox-selected-color);
    background: var(--global-checkbox-selected-color);
  }

  &[data-selected="true"] .option-button__indicator--checkbox svg {
    stroke-dashoffset: 44;
  }

  .option-button__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .option-button__label {
    line-height: var(--global-line-height-s);
  }

  .option-button__description {
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-500);
    line-height: var(--global-line-height-s);

    .theme--light & {
      color: var(--global-text-color-600);
    }
  }

  .option-button__text-entry {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-75);
    flex: 1;
    min-width: 0;
  }

  .option-button__text-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    border-bottom: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    outline: none;
    color: var(--global-text-color-900);
    font-size: var(--global-font-size-s);
    font-family: inherit;
    padding: 2px 4px;
    transition: border-color 0.15s ease;

    &::placeholder {
      color: var(--global-text-color-500);
    }

    &:focus {
      border-color: var(--global-text-color-700);
    }
  }
`;
