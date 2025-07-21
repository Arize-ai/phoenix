import { css } from "@emotion/react";

export const listCSS = css`
  list-style: none;
  padding: 0;
  margin: 0;

  & li {
    position: relative;
    padding: var(--ac-global-dimension-static-size-200);
  }
  &[data-list-size="S"] {
    & li {
      padding: var(--ac-global-dimension-static-size-100);
    }
  }
`;
