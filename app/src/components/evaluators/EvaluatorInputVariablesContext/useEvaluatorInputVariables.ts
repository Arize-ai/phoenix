import { useContext } from "react";
import invariant from "tiny-invariant";

import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

export const useEvaluatorInputVariables = () => {
  const context = useContext(EvaluatorInputVariablesContext);
  invariant(
    context,
    "useEvaluatorsInputVariables must be used within LLMEvaluatorInputVariablesProvider or CodeEvaluatorInputVariablesProvider"
  );
  return context;
};
