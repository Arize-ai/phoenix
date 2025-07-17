import { CopyToClipboardButton } from "../CopyToClipboardButton";

import { codeBlockWithCopyCSS } from "./styles";
import { TypeScriptBlock } from "./TypeScriptBlock";

export function TypeScriptBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="typescript-code-block" css={codeBlockWithCopyCSS}>
      <CopyToClipboardButton text={value} />
      <TypeScriptBlock value={value} />
    </div>
  );
}
