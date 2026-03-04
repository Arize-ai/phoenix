import { type PropsWithChildren, useMemo } from "react";

import type { EvaluatorParam } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { extractPythonFunctionParams } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/extractPythonFunctionParams";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const SourceCodeEvaluatorInputVariablesProvider = ({
  children,
}: PropsWithChildren) => {
  const sourceCode = useEvaluatorStore((state) => state.sourceCode);
  const variables: EvaluatorParam[] = useMemo(
    () => extractPythonFunctionParams(sourceCode),
    [sourceCode]
  );
  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
