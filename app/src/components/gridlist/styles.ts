import { css } from "@emotion/react";

export const gridListCss = css`
  --menu-min-width: 250px;
  min-width: var(--menu-min-width);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-menu-item-gap);
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--ac-global-menu-item-gap);
  &:focus-visible {
    border-radius: var(--ac-global-rounding-small);
    outline: 2px solid var(--ac-global-color-primary);
    outline-offset: 0px;
  }
  &[data-empty] {
    align-items: center;
    justify-content: center;
    display: flex;
    padding: var(--ac-global-dimension-static-size-100);
  }

  .react-aria-GridListSection {
    display: flex;
    flex-direction: column;
    gap: var(--ac-global-menu-item-gap);
  }
`;

export const gridListItemCss = css`
  border-radius: var(--ac-global-rounding-small);
  outline: none;
  cursor: default;
  color: var(--ac-global-text-color-900);
  position: relative;
  display: flex;
  gap: var(--ac-global-menu-item-gap);
  align-items: center;
  justify-content: space-between;

  &[data-disabled] {
    cursor: not-allowed;
    color: var(--ac-global-color-text-300);
    opacity: var(--ac-global-opacity-disabled);
  }

  &[data-focus-visible] {
    outline: none;
  }

  @media (forced-colors: active) {
    &[data-focused] {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }
  }

  &[data-focus-visible] {
    .GridListItem__content {
      background-color: var(--ac-global-menu-item-background-color-hover);
    }
  }

  .GridListItem__content {
    padding: var(--ac-global-menu-item-gap);
    padding-left: var(--ac-global-dimension-static-size-100);
    border-radius: var(--ac-global-rounding-small);

    &:hover {
      background-color: var(--ac-global-menu-item-background-color-hover);
    }
  }
`;

export const gridListSectionTitleCss = css`
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100) 0;
`;

export const gridListSectionCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-menu-item-gap);
`;
