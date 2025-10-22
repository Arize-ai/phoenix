import { css } from "@emotion/react";

export const selectCSS = css`
  // TODO: respect trailingVisual and leadingVisual inside of phoenix button
  // ideally the content is justified start with leading visual, and trailing visual
  // is positioned at the end
  // the current styling assumes content + 1 trailing visual
  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 200px;
    width: 100%;

    &[data-pressed],
    &:hover {
      --button-border-color: var(--ac-global-input-field-border-color-active);
    }
  }

  button[data-size="S"][data-childless="false"] {
    padding-right: var(--ac-global-dimension-size-50);
  }

  button[data-size="M"][data-childless="false"] {
    padding-right: var(--ac-global-dimension-size-100);
  }

  &[data-invalid="true"] button {
    border-color: var(--ac-global-color-danger);
  }

  .react-aria-SelectValue {
    &[data-placeholder] {
      font-style: italic;
      color: var(--ac-text-color-placeholder);
    }
  }
`;
