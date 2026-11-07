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
  selection: CompareSelection | null;
  optimisticSelection: CompareSelection | null;
  isPending: boolean;
  setSelection: (
    next: CompareSelection | null,
    options?: { replace?: boolean }
  ) => void;
};

const CompareSelectionContext =
  createContext<CompareSelectionContextValue | null>(null);

/** Keeps URL-backed selection responsive while matching targets load. */
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
