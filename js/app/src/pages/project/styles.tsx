import { css } from "@emotion/react";

export const spansTableCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  // Style the column selector
  .dropdown__button {
    min-width: var(--global-dimension-size-300);
  }
`;
