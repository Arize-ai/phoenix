import { useContext } from "react";
import { invariant } from "@apollo/client/utilities/globals";

import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

export const useEvaluatorInputVariables = () => {
  const context = useContext(EvaluatorInputVariablesContext);
  invariant(
    context,
    "useEvaluatorsInputVariables must be used within LLMEvaluatorInputVariablesProvider or CodeEvaluatorInputVariablesProvider"
  );
  return context;
};
