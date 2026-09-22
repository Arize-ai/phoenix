import type { PropsWithChildren } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { useDerivedPlaygroundVariables } from "@phoenix/pages/playground/useDerivedPlaygroundVariables";

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
  const { variableKeys: variables } = useDerivedPlaygroundVariables({
    instanceId,
  });

  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
