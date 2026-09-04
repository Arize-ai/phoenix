import { BashBlock } from "./BashBlock";
import { CodeBlockWithCopy, NO_GUTTERS_BASIC_SETUP } from "./CodeBlockWithCopy";

export function BashBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <CodeBlockWithCopy value={value}>
      <BashBlock value={value} basicSetup={NO_GUTTERS_BASIC_SETUP} />
    </CodeBlockWithCopy>
  );
}
