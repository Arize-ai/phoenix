import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import {
  toEvaluatorMappingSourceGrain,
  type ProjectEvaluatorTarget,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

/** Must be called under an `EvaluatorStoreProvider`. */
export const useProjectEvaluatorSubmitHint = ({
  targetType,
  isFilterValid,
  submitLabel = "create",
}: {
  /** Names the filter the author has to fix, in the records' own noun. */
  targetType: ProjectEvaluatorTarget;
  isFilterValid: boolean;
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
  return undefined;
};
