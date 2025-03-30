import { css } from "@emotion/react";

export const codeBlockWithCopyCSS = css`
  position: relative;
  --code-block-min-height: 40px;
  min-height: var(--code-block-min-height);
  display: flex;
  flex-direction: row;
  align-items: center;
  .cm-theme,
  .cm-editor {
    width: 100%;
    min-height: var(--code-block-min-height);
  }
  .cm-editor {
    padding-top: var(--ac-global-dimension-size-100);
    padding-bottom: var(--ac-global-dimension-size-100);
  }
  .cm-gutters,
  .cm-gutters * {
    background: none;
    background-color: transparent !important;
    border-right: none;
  }
  .copy-to-clipboard-button {
    position: absolute;
    top: var(--ac-global-dimension-size-100);
    right: var(--ac-global-dimension-size-100);
    z-index: 1;
  }
`;
