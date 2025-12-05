import {
  type CodeLanguage,
  PythonBlock,
  TypeScriptBlock,
} from "@phoenix/components/code";
import { assertUnreachable } from "@phoenix/typeUtils";

export function CodeBlock({
  language,
  value,
}: {
  language: CodeLanguage;
  value: string;
}) {
  switch (language) {
    case "Python":
      return <PythonBlock value={value} basicSetup={{ lineNumbers: true }} />;
    case "TypeScript":
      return (
        <TypeScriptBlock value={value} basicSetup={{ lineNumbers: true }} />
      );
    default:
      assertUnreachable(language);
  }
}
