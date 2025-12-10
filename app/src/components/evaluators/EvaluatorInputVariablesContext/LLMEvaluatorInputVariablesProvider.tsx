import { type PropsWithChildren } from "react";

import { EvaluatorsInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorsInputVariablesProvider";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";

export const LLMEvaluatorInputVariablesProvider = ({
  children,
}: PropsWithChildren) => {
  const { variableKeys: variables } = useDerivedPlaygroundVariables();

  return (
    <EvaluatorsInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorsInputVariablesProvider>
  );
};
