import { type PropsWithChildren } from "react";

import { EvaluatorsInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorsInputVariablesContext";

export const EvaluatorsInputVariablesProvider = ({
  children,
  variables,
}: PropsWithChildren<{ variables: string[] }>) => {
  return (
    <EvaluatorsInputVariablesContext.Provider value={variables}>
      {children}
    </EvaluatorsInputVariablesContext.Provider>
  );
};
