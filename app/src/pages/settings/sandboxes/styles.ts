import { css } from "@emotion/react";

import { tableCSS } from "@phoenix/components/table/styles";

export const pageIntroCSS = css`
  padding: var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
`;

export const cardIntroCSS = css`
  padding: var(--global-dimension-size-200);
  border-bottom: 1px solid var(--global-border-color-default);
`;

export const sandboxesTableWrapCSS = css`
  overflow: hidden;
`;

export const sandboxesTableCSS = css(
  tableCSS,
  css`
    thead {
      position: static;
    }
  `
);

export const emptyStateWrapCSS = css`
  padding: var(--global-dimension-size-500) var(--global-dimension-size-300);
`;

export const configNameCellCSS = css`
  min-width: 260px;
`;

export const configNameCSS = css`
  font-weight: 600;
`;

export const subtitleCSS = css`
  color: var(--ac-global-text-color-700);
  font-size: var(--global-font-size-s);
`;

export const inlineTokenRowCSS = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--global-dimension-size-50);
  align-items: center;
`;
