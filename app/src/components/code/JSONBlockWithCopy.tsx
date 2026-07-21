import { CodeBlockWithCopy, NO_GUTTERS_BASIC_SETUP } from "./CodeBlockWithCopy";
import { JSONBlock } from "./JSONBlock";

export function JSONBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <CodeBlockWithCopy value={value}>
      <JSONBlock value={value} basicSetup={NO_GUTTERS_BASIC_SETUP} />
    </CodeBlockWithCopy>
  );
}
