import { type PropsWithChildren, useMemo } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";

export const LLMEvaluatorInputVariablesProvider = ({
  children,
}: PropsWithChildren) => {
  const { variableKeys } = useDerivedPlaygroundVariables();
  const variables = useMemo(
    () => variableKeys.map((name) => ({ name })),
    [variableKeys]
  );

  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
