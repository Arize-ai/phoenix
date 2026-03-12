import { type PropsWithChildren, useMemo } from "react";

import type { EvaluatorParam } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { extractPythonFunctionParams } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/extractPythonFunctionParams";
import { extractTypeScriptFunctionParams } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/extractTypeScriptFunctionParams";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const SourceCodeEvaluatorInputVariablesProvider = ({
  children,
}: PropsWithChildren) => {
  const sourceCode = useEvaluatorStore((state) => state.sourceCode);
  const language = useEvaluatorStore((state) => state.language);
  const variables: EvaluatorParam[] = useMemo(() => {
    if (language === "TYPESCRIPT") {
      return extractTypeScriptFunctionParams(sourceCode);
    }
    return extractPythonFunctionParams(sourceCode);
  }, [sourceCode, language]);
  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
