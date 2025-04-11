import { css } from "@emotion/react";

export const messageContainerCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
  width: 100%;
  &[data-outgoing="true"] {
    align-self: flex-end;
  }
  &[data-outgoing="false"] {
    align-self: flex-start;
  }
`;

export const messageRowCSS = css`
  display: flex;
  gap: var(--ac-global-dimension-size-100);
  width: 80%;
  align-items: flex-end;
  &[data-outgoing="true"] {
    flex-direction: row-reverse;
    align-self: flex-end;
  }
`;
