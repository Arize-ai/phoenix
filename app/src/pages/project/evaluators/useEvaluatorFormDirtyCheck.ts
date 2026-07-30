import { useEffect, useRef } from "react";

import type { PlaygroundStore } from "@phoenix/store";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

export type EvaluatorFormDirtyCheck = () => boolean;

/**
 * Returns a `trackStore` callback that must be invoked inside the evaluator
 * store provider's render prop.
 */
export function useEvaluatorFormDirtyCheck({
  registerDirtyCheck,
  scope,
  playgroundStore,
  alwaysDirty = false,
}: {
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
  scope: unknown;
  /** Pass when the form edits a prompt template (LLM evaluators). */
  playgroundStore?: PlaygroundStore;
  /**
   * For forms whose content lives in local state this hook cannot observe
   * (e.g. the code source editor).
   */
  alwaysDirty?: boolean;
}) {
  const storeRef = useRef<EvaluatorStoreInstance | null>(null);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const baselineRef = useRef<string | null>(null);
  useEffect(() => {
    const getSnapshot = () => {
      const storeState = storeRef.current?.getState();
      return JSON.stringify({
        evaluator: storeState?.evaluator,
        outputConfigs: storeState?.outputConfigs,
        template: playgroundStore?.getState().instances[0]?.template,
        scope: scopeRef.current,
      });
    };
    baselineRef.current = getSnapshot();
    registerDirtyCheck(() => {
      if (alwaysDirty) {
        return true;
      }
      return baselineRef.current == null
        ? true
        : getSnapshot() !== baselineRef.current;
    });
    // Mount-only: every input feeding the registered closure is read through a
    // ref or stable store handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (store: EvaluatorStoreInstance) => {
    storeRef.current = store;
  };
}
