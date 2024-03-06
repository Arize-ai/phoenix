import { css } from "@emotion/react";

export const spansTableCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  .span-filter-condition-field {
    flex: 1 1 auto;
  }

  // Style the column selector
  .ac-dropdown-button {
    min-width: var(--ac-global-dimension-static-size-300);
  }
`;
