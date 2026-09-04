import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import type { ProgrammingLanguage } from "@phoenix/types/code";

export function ImplementationCodeBlock({
  language,
  code,
}: {
  language: ProgrammingLanguage;
  code: string;
}) {
  if (language === "Python") {
    return <PythonBlockWithCopy value={code} />;
  }
  return <TypeScriptBlockWithCopy value={code} />;
}
