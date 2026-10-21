import type { PropsWithChildren } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useLLMEvaluatorVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useLLMEvaluatorVariables";

export const LLMEvaluatorInputVariablesProvider = ({
  children,
  instanceId,
}: PropsWithChildren<{
  /**
   * The instance whose judge prompt supplies the variables. Omit where the
   * playground holds one judge prompt, as the evaluator dialogs do.
   */
  instanceId?: number;
}>) => {
  const variables = useLLMEvaluatorVariables({ instanceId });

  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
