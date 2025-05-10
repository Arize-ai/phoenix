import { css } from "@emotion/react";

export const markdownCSS = css`
  a {
    color: var(--ac-global-link-color);
    &:visited {
      color: var(--ac-global-link-color-visited);
    }
  }
  /* Remove the margin on the first and last paragraph */
  p:first-child {
    margin-top: 0;
  }
  p:last-child {
    margin-bottom: 0;
  }
  code {
    text-wrap: wrap;
  }
`;
