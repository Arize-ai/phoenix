import { css } from "@emotion/react";

export const readOnlyCodeMirrorCSS = css`
  .cm-content {
    padding: var(--ac-global-dimension-static-size-200) 0;
  }
  .cm-editor,
  .cm-gutters {
    background-color: transparent;
  }
`;

export const codeBlockWithCopyCSS = css`
  position: relative;
  .copy-to-clipboard-button {
    position: absolute;
    top: var(--ac-global-dimension-size-100);
    right: var(--ac-global-dimension-size-100);
    z-index: 1;
  }
`;
