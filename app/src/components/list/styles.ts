import { css } from "@emotion/react";

export const listCSS = css`
  list-style: none;
  padding: 0;
  margin: 0;

  & li {
    position: relative;
    padding: var(--global-dimension-static-size-200);

    &:not(:first-of-type)::after {
      content: " ";
      border-top: 1px solid var(--global-border-color-default);
      position: absolute;
      left: var(--global-dimension-static-size-200);
      right: 0;
      top: 0;
    }
  }

  &[data-list-size="S"] {
    & li {
      padding: var(--global-dimension-static-size-100);

      &:not(:first-of-type)::after {
        left: var(--global-dimension-static-size-100);
      }
    }
  }
`;
