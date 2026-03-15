import { CopyButton } from "../core/copy/CopyButton";
import { codeBlockWithCopyCSS } from "./styles";
import { TypeScriptBlock } from "./TypeScriptBlock";

export function TypeScriptBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="typescript-code-block" css={codeBlockWithCopyCSS}>
      <CopyButton text={value} />
      <TypeScriptBlock value={value} />
    </div>
  );
}
