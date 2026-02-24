import { useContext } from "react";
import invariant from "tiny-invariant";

import { EvaluatorInputVariablesContext } from "@phoenix/features/experiments/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";

export const useEvaluatorInputVariables = () => {
  const context = useContext(EvaluatorInputVariablesContext);
  invariant(
    context,
    "useEvaluatorsInputVariables must be used within LLMEvaluatorInputVariablesProvider or CodeEvaluatorInputVariablesProvider"
  );
  return context;
};
