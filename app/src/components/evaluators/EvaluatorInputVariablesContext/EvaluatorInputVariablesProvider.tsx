import type { PropsWithChildren } from "react";

import {
  EvaluatorInputVariablesContext,
  type EvaluatorParam,
} from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

export const EvaluatorInputVariablesProvider = ({
  children,
  variables,
}: PropsWithChildren<{ variables: EvaluatorParam[] }>) => {
  return (
    <EvaluatorInputVariablesContext.Provider value={variables}>
      {children}
    </EvaluatorInputVariablesContext.Provider>
  );
};
