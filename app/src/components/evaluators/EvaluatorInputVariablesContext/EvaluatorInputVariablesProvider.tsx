import { type PropsWithChildren } from "react";

import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

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
