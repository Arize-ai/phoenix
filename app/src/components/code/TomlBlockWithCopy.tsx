import { CodeBlockWithCopy, NO_GUTTERS_BASIC_SETUP } from "./CodeBlockWithCopy";
import { TomlBlock } from "./TomlBlock";

export function TomlBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <CodeBlockWithCopy value={value}>
      <TomlBlock value={value} basicSetup={NO_GUTTERS_BASIC_SETUP} />
    </CodeBlockWithCopy>
  );
}
