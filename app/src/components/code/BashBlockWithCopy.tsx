import { CopyToClipboardButton } from "../CopyToClipboardButton";
import { BashBlock } from "./BashBlock";
import { codeBlockWithCopyCSS } from "./styles";

export function BashBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <div className="bash-code-block" css={codeBlockWithCopyCSS}>
      <CopyToClipboardButton text={value} />
      <BashBlock value={value} />
    </div>
  );
}
