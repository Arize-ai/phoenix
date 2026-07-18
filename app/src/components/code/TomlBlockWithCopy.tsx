import { CopyToClipboardButton } from "../core/copy";
import { codeBlockWithCopyCSS } from "./styles";
import { TomlBlock } from "./TomlBlock";

export function TomlBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="toml-code-block" css={codeBlockWithCopyCSS}>
      <CopyToClipboardButton text={value} />
      <TomlBlock value={value} />
    </div>
  );
}
