import { CopyToClipboardButton } from "../core/copy";
import { JSONBlock } from "./JSONBlock";
import { codeBlockWithCopyCSS } from "./styles";

export function JSONBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="json-code-block" css={codeBlockWithCopyCSS}>
      <CopyToClipboardButton text={value} />
      <JSONBlock
        value={value}
        basicSetup={{ lineNumbers: false, foldGutter: false }}
      />
    </div>
  );
}
