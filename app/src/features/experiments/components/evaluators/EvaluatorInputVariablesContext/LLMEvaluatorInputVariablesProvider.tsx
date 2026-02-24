import type { PropsWithChildren } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/features/experiments/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useDerivedPlaygroundVariables } from "@phoenix/features/playground/pages/useDerivedPlaygroundVariables";

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
