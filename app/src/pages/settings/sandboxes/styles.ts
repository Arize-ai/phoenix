import { css } from "@emotion/react";

import { tableCSS } from "@phoenix/components/table/styles";

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
