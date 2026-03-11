import { PythonBlockWithCopy } from "@phoenix/components/code/PythonBlockWithCopy";
import { TypeScriptBlockWithCopy } from "@phoenix/components/code/TypeScriptBlockWithCopy";
import {
  getOtelInitCodePython,
  getOtelInitCodeTypescript,
} from "@phoenix/components/project/integrationSnippets";
import type { ProgrammingLanguage } from "@phoenix/types/code";

export function ImplementationCodeBlock({
  language,
  projectName,
  isHosted,
}: {
  language: ProgrammingLanguage;
  projectName: string;
  /** Whether the app is running on a hosted (cloud) deployment, which affects the generated code snippet (e.g. endpoint configuration). */
  isHosted: boolean;
}) {
  if (language === "Python") {
    return (
      <PythonBlockWithCopy
        value={getOtelInitCodePython({ isHosted, projectName })}
      />
    );
  }
  return (
    <TypeScriptBlockWithCopy value={getOtelInitCodeTypescript(projectName)} />
  );
}
