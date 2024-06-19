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
