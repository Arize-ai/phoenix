import { useContext } from "react";
import { invariant } from "@apollo/client/utilities/globals";

import { EvaluatorsInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorsInputVariablesContext";

export const useEvaluatorsInputVariables = () => {
  const context = useContext(EvaluatorsInputVariablesContext);
  invariant(
    context,
    "useEvaluatorsInputVariables must be used within LLMEvaluatorInputVariablesProvider or CodeEvaluatorInputVariablesProvider"
  );
  return context;
};
