import { useContext } from "react";
import { useZustand } from "use-zustand";

import { EvaluatorContext } from "@phoenix/contexts/EvaluatorContext/EvaluatorContext";
import type { EvaluatorStore } from "@phoenix/store/evaluatorStore";

/**
 * Hook to get the the nearest EvaluatorContext EvaluatorStoreInstance.
 *
 * @returns vanilla zustand store instance
 */
export const useEvaluatorStoreInstance = () => {
  const store = useContext(EvaluatorContext);
  if (!store) throw new Error("Missing EvaluatorContext.Provider in the tree");
  return store;
};

/**
 * Hook to get a specific part of the EvaluatorStore.
 *
 * @param selector - function to select a specific part of the store
 * @param equalityFn - function to compare the selected part of the store
 * @returns the selected part of the store
 */
export const useEvaluatorStore = <T,>(
  selector: (state: EvaluatorStore) => T,
  equalityFn?: (left: T, right: T) => boolean
): T => {
  const store = useEvaluatorStoreInstance();
  return useZustand(store, selector, equalityFn);
};
