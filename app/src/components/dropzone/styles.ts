import { css } from "@emotion/react";

export const fileDropZoneCSS = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-400);
  min-height: 160px;
  border: 2px dashed var(--global-input-field-border-color);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-input-field-background-color);
  color: var(--global-text-color-700);
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.2s ease-in-out,
    background-color 0.2s ease-in-out;

  &[data-focus-visible] {
    outline: 2px solid var(--global-input-field-border-color-active);
    outline-offset: 2px;
  }

  &[data-drop-target] {
    border-color: var(--global-color-primary);
    background-color: var(--global-color-primary-100);
  }

  &[data-disabled] {
    cursor: not-allowed;
    opacity: var(--global-opacity-disabled);
  }

  .file-drop-zone__icon {
    color: var(--global-text-color-500);
    width: 40px;
    height: 40px;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }

  &[data-drop-target] .file-drop-zone__icon {
    color: var(--global-color-primary);
  }

  .file-drop-zone__label {
    font-size: var(--global-font-size-m);
    font-weight: 500;
    color: var(--global-text-color-900);
  }

  .file-drop-zone__description {
    font-size: var(--global-font-size-s);
    color: var(--global-text-color-700);
  }

  .file-drop-zone__browse-row {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
  }

  .file-drop-zone__or-text {
    font-size: var(--global-font-size-s);
    color: var(--global-text-color-500);
  }
`;

export const fileListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  width: 100%;
  margin-top: var(--global-dimension-size-200);

  .file-list__item {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-150);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    background-color: var(--global-color-gray-100);
    border-radius: var(--global-rounding-small);
    border: 1px solid var(--global-color-gray-200);
  }

  .file-list__item[data-status="error"] {
    border-color: var(--global-severity-danger);
    background-color: var(--global-severity-danger-100);
  }

  .file-list__icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--global-text-color-500);

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }

  .file-list__details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
  }

  .file-list__name {
    font-size: var(--global-font-size-s);
    font-weight: 500;
    color: var(--global-text-color-900);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-list__meta {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    font-size: var(--global-font-size-xs);
    color: var(--global-text-color-700);
  }

  .file-list__error {
    font-size: var(--global-font-size-xs);
    color: var(--global-severity-danger);
  }

  .file-list__progress {
    flex: 1;
  }

  .file-list__remove {
    flex-shrink: 0;
  }
`;
