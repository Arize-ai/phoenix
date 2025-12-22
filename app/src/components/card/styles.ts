import { CSSProperties } from "react";
import { css } from "@emotion/react";

export const cardCSS = (style?: CSSProperties) => css`
  --scope-border-color: ${style?.borderColor ??
  "var(--ac-global-border-color-default)"};
  --collapsible-card-animation-duration: 200ms;
  --collapsible-card-icon-size: var(--ac-global-dimension-size-300);

  display: flex;
  flex-direction: column;
  background-color: var(--ac-global-background-color-dark);
  color: var(--ac-global-text-color-900);
  border-radius: var(--ac-global-rounding-medium);
  border: 1px solid var(--scope-border-color);
  overflow: hidden;
  box-sizing: border-box;

  /* Card Header Styles */
  & > header {
    display: flex;
    flex-direction: row;
    flex: none;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--ac-global-dimension-static-size-200);
    height: var(--ac-global-card-header-height);
    transition: background-color 0.2s ease-in-out;

    & .card__collapse-toggle-icon {
      width: var(--collapsible-card-icon-size);
      height: var(--collapsible-card-icon-size);
      font-size: 1.3em;
      color: inherit;
      display: flex;
      margin-right: var(--ac-global-dimension-static-size-100);
      transition: transform ease var(--collapsible-card-animation-duration);

      & svg {
        height: var(--collapsible-card-icon-size);
        width: var(--collapsible-card-icon-size);
      }
    }

    & .card__title {
      font-size: var(--ac-global-font-size-m);
      line-height: var(--ac-global-line-height-m);
      display: flex;
      align-items: center;
      gap: var(--ac-global-dimension-static-size-100);
    }

    & .card__sub-title {
      color: var(--ac-global-text-color-700);
    }

    /* Collapsible button styles */
    & .card__collapsible-button {
      display: flex;
      flex: 1;
      flex-direction: row;
      align-items: center;
      text-align: left;
      width: 100%;
      height: 100%;
      appearance: none;
      cursor: pointer;
      color: var(--ac-global-text-color-900);
    }
  }

  &[data-collapsed="false"][data-title-separator="true"] > header {
    border-bottom: 1px solid var(--scope-border-color);
  }

  /* Card Body Styles */
  & .card__body {
    flex: 1 1 auto;
    &[data-scrollable="true"] {
      overflow-y: auto;
    }
  }

  /* Compact variant styles */
  &[data-variant="compact"] .card__title {
    font-size: var(--ac-global-font-size-m);
    line-height: var(--ac-global-line-height-m);
  }

  /* Collapsible behavior */
  &[data-collapsible="true"] {
    & > header:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  &[data-collapsed="true"] {
    & .card__body {
      display: none !important;
    }
    & .card__collapse-toggle-icon {
      transform: rotate(-90deg);
    }
  }
`;
