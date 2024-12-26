import { css } from "@emotion/react";

export const readOnlyCodeMirrorCSS = css`
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

export const codeBlockWithCopyCSS = css`
  position: relative;
  min-height: 47px;
  display: flex;
  flex-direction: row;
  align-items: center;
  .copy-to-clipboard-button {
    position: absolute;
    top: var(--ac-global-dimension-size-100);
    right: var(--ac-global-dimension-size-100);
    z-index: 1;
  }
`;
