import {
  createContext,
  type PropsWithChildren,
  useContext,
  useOptimistic,
  useTransition,
} from "react";
import { useSearchParams } from "react-router";

import { PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM } from "@phoenix/constants/searchParams";

import {
  type CompareSelection,
  encodeCompareSelection,
  parseCompareSelection,
} from "./projectEvaluatorCompareSelection";

type CompareSelectionContextValue = {
  /** The committed selection from the URL. Drives the loaded targets. */
  selection: CompareSelection | null;
  /**
   * The selection the user just chose, shown at once while `isPending`.
   * Equals `selection` otherwise.
   */
  optimisticSelection: CompareSelection | null;
  /** True from a selection change until the targets for it have loaded. */
  isPending: boolean;
  setSelection: (
    next: CompareSelection | null,
    options?: { replace?: boolean }
  ) => void;
};

const CompareSelectionContext =
  createContext<CompareSelectionContextValue | null>(null);

/**
 * Owns the matrix selection stored in the URL. A change navigates inside a
 * transition, so the current targets stay on screen while the next ones load;
 * the optimistic copy lets the matrix and heading respond immediately.
 */
export function CompareSelectionProvider({ children }: PropsWithChildren) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = parseCompareSelection(
    searchParams.get(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM)
  );
  const [optimisticSelection, setOptimisticSelection] =
    useOptimistic(selection);
  const [isPending, startTransition] = useTransition();
  const setSelection = (
    next: CompareSelection | null,
    options?: { replace?: boolean }
  ) => {
    startTransition(() => {
      setOptimisticSelection(next);
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        if (next) {
          params.set(
            PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM,
            encodeCompareSelection(next)
          );
        } else {
          params.delete(PROJECT_EVALUATOR_COMPARE_SELECTION_PARAM);
        }
        return params;
      }, options);
    });
  };
  return (
    <CompareSelectionContext
      value={{ selection, optimisticSelection, isPending, setSelection }}
    >
      {children}
    </CompareSelectionContext>
  );
}

export function useCompareSelection() {
  const value = useContext(CompareSelectionContext);
  if (!value) {
    throw new Error(
      "useCompareSelection must be used within a CompareSelectionProvider"
    );
  }
  return value;
}
