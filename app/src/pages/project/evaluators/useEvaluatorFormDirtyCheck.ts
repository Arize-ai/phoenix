import { useEffect, useRef } from "react";

import type { PlaygroundStore } from "@phoenix/store";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

export type EvaluatorFormDirtyCheck = () => boolean;

/**
 * Tracks whether a project-evaluator form has unsaved edits by snapshotting
 * the pristine form state at mount and comparing on demand. The comparison is
 * lazy — nothing is computed until a dismissal actually asks — so typing in
 * the form costs nothing.
 *
 * Returns a `trackStore` callback to invoke inside the store provider's render
 * prop so the hook can read the evaluator store lazily.
 */
export function useEvaluatorFormDirtyCheck({
  registerDirtyCheck,
  scope,
  playgroundStore,
  alwaysDirty = false,
}: {
  /** Hands the parent overlay a callback that reports current dirtiness. */
  registerDirtyCheck: (check: EvaluatorFormDirtyCheck) => void;
  /** The live scope object; compared against its at-mount value. */
  scope: unknown;
  /** Included when the form edits a prompt template (LLM evaluators). */
  playgroundStore?: PlaygroundStore;
  /**
   * Forces the check to report dirty — for forms whose primary content lives
   * in local state this hook cannot observe (e.g. the code source editor).
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
      // A missing baseline means we cannot prove the form is pristine, so
      // err on the side of confirming.
      return baselineRef.current == null
        ? true
        : getSnapshot() !== baselineRef.current;
    });
    // Mount-only: the baseline is the pristine form, and every input feeding
    // the registered closure is read through a ref or stable store handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (store: EvaluatorStoreInstance) => {
    storeRef.current = store;
  };
}
