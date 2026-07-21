import { CodeBlockWithCopy, NO_GUTTERS_BASIC_SETUP } from "./CodeBlockWithCopy";
import { PythonBlock } from "./PythonBlock";

export function PythonBlockWithCopy(props: { value: string }) {
  const { value } = props;
  return (
    <CodeBlockWithCopy value={value}>
      <PythonBlock value={value} basicSetup={NO_GUTTERS_BASIC_SETUP} />
    </CodeBlockWithCopy>
  );
}
