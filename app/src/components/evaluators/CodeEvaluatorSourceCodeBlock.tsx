import { PythonBlock } from "@phoenix/components/code/PythonBlock";
import { TypeScriptBlock } from "@phoenix/components/code/TypeScriptBlock";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

export const CodeEvaluatorSourceCodeBlock = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}) => {
  if (language === "PYTHON") {
    return <PythonBlock value={sourceCode} />;
  }
  return <TypeScriptBlock value={sourceCode} />;
};
