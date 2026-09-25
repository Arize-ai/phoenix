import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  getUnboundRequiredVariables,
  toEvaluatorMappingSourceGrain,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

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

/** Names the variables a save is waiting on. */
export function formatUnboundVariablesHint(
  unboundVariables: readonly string[],
  submitLabel: string
): string | undefined {
  return unboundVariables.length > 0
    ? `Map ${unboundVariables.join(", ")} to ${submitLabel}`
    : undefined;
}

/** Must be called under an `EvaluatorStoreProvider`. */
export const useProjectEvaluatorSubmitHint = ({
  targetType,
  isFilterValid,
  unboundVariables = [],
  submitLabel = "create",
}: {
  /** Names the filter the author has to fix, in the records' own noun. */
  targetType: ProjectEvaluatorTarget;
  isFilterValid: boolean;
  unboundVariables?: readonly string[];
  submitLabel?: string;
}): string | undefined => {
  const name = useEvaluatorStore((state) => state.evaluator.globalName);
  if (!name.trim()) {
    return `Name your evaluator to ${submitLabel}`;
  }
  if (!isFilterValid) {
    const filterNoun = toEvaluatorMappingSourceGrain(targetType);
    return `Fix the ${filterNoun} filter to ${submitLabel}`;
  }
  return formatUnboundVariablesHint(unboundVariables, submitLabel);
};
