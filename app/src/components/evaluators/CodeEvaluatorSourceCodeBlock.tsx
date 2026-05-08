import { PythonBlock } from "@phoenix/components/code/PythonBlock";
import { TypeScriptBlock } from "@phoenix/components/code/TypeScriptBlock";
import type { CodeEvaluatorLanguage } from "@phoenix/types";

const BASIC_SETUP = { lineNumbers: true };

export const CodeEvaluatorSourceCodeBlock = ({
  language,
  sourceCode,
}: {
  language: CodeEvaluatorLanguage;
  sourceCode: string;
}) => {
  if (language === "PYTHON") {
    return <PythonBlock value={sourceCode} basicSetup={BASIC_SETUP} />;
  }
  return <TypeScriptBlock value={sourceCode} basicSetup={BASIC_SETUP} />;
};
