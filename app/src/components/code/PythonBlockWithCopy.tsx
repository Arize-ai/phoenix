import { CopyButton } from "../core/copy/CopyButton";
import { PythonBlock } from "./PythonBlock";
import { codeBlockWithCopyCSS } from "./styles";

export function PythonBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="python-code-block" css={codeBlockWithCopyCSS}>
      <CopyButton text={value} />
      <PythonBlock value={value} />
    </div>
  );
}
