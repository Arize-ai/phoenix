import { css } from "@emotion/react";

export const markdownCSS = css`
  a {
    color: var(--ac-global-color-primary);
    &:visited {
      color: var(--ac-global-color-purple-900);
    }
  }
  /* Remove the margin on the first and last paragraph */
  p:first-child {
    margin-top: 0;
  }
  p:last-child {
    margin-bottom: 0;
  }
`;
