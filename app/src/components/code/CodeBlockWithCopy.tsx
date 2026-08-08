import type { BasicSetupOptions } from "@uiw/react-codemirror";
import type { ReactNode } from "react";

import { CopyToClipboardButton } from "../core/copy";
import { codeBlockWithCopyCSS } from "./styles";

/**
 * The shell hides gutters via CSS regardless; pass this to the wrapped block
 * so CodeMirror doesn't build line-number/fold extensions that never show.
 */
export const NO_GUTTERS_BASIC_SETUP: BasicSetupOptions = {
  lineNumbers: false,
  foldGutter: false,
};

/**
 * Shared shell for the read-only per-language *BlockWithCopy components: a
 * readonly-field surface with an embedded copy button overlaying the block.
 */
export function CodeBlockWithCopy(props: {
  value: string;
  children: ReactNode;
}) {
  const { value, children } = props;
  return (
    <div className="code-block-with-copy" css={codeBlockWithCopyCSS}>
      <CopyToClipboardButton text={value} />
      {children}
    </div>
  );
}
