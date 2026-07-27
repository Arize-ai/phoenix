import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

/**
 * Names the one thing still missing before a project evaluator can be
 * submitted, or `undefined` when the form is completable. Must be called
 * under an `EvaluatorStoreProvider`.
 */
export const useProjectEvaluatorSubmitHint = ({
  isFilterValid,
  submitLabel = "create",
}: {
  isFilterValid: boolean;
  submitLabel?: string;
}): string | undefined => {
  const name = useEvaluatorStore((state) => state.evaluator.globalName);
  if (!name.trim()) {
    return `Name your evaluator to ${submitLabel}`;
  }
  if (!isFilterValid) {
    return `Fix the span filter to ${submitLabel}`;
  }
  return undefined;
};
