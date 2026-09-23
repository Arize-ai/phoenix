import { CodeBlockWithCopy, NO_GUTTERS_BASIC_SETUP } from "./CodeBlockWithCopy";
import { TypeScriptBlock } from "./TypeScriptBlock";

export function TypeScriptBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <CodeBlockWithCopy value={value}>
      <TypeScriptBlock value={value} basicSetup={NO_GUTTERS_BASIC_SETUP} />
    </CodeBlockWithCopy>
  );
}
