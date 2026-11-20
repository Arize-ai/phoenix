import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { getUnboundRequiredVariables } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/**
 * The declared variables that still need a path before the evaluator can be
 * saved. Must be called under an `EvaluatorStoreProvider`.
 */
export const useUnboundRequiredVariables = ({
  variables,
  requiredVariables,
}: {
  variables: readonly string[];
  requiredVariables?: readonly string[];
}): string[] => {
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  return getUnboundRequiredVariables({
    variables,
    requiredVariables,
    inputMapping,
  });
};
