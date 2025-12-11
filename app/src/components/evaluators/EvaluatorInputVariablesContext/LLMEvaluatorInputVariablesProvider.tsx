import { type PropsWithChildren } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";

export const LLMEvaluatorInputVariablesProvider = ({
  children,
}: PropsWithChildren) => {
  const { variableKeys: variables } = useDerivedPlaygroundVariables();

  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
