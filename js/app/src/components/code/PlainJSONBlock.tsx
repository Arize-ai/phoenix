import { css } from "@emotion/react";

import { JSONBlock } from "./JSONBlock";

const jsonBlockCSS = css`
  .cm-editor {
    background: transparent !important;
  }
`;

const basicSetup = { lineNumbers: false, foldGutter: false };

/** Displays JSON without a separate background, line numbers, or fold gutter. */
export function PlainJSONBlock({ value }: { value: string }) {
  return <JSONBlock value={value} css={jsonBlockCSS} basicSetup={basicSetup} />;
}
