import type { PropsWithChildren } from "react";

import { EvaluatorInputVariablesContext } from "@phoenix/features/experiments/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

export const EvaluatorInputVariablesProvider = ({
  children,
  variables,
}: PropsWithChildren<{ variables: string[] }>) => {
  return (
    <EvaluatorInputVariablesContext.Provider value={variables}>
      {children}
    </EvaluatorInputVariablesContext.Provider>
  );
};
