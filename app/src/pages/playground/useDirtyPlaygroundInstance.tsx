import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounce, pick } from "lodash";

import {
  usePlaygroundContext,
  usePlaygroundStore,
} from "@phoenix/contexts/PlaygroundContext";
import { PlaygroundInstance } from "@phoenix/store";

/**
 * Hook to track dirty state of a playground instance
 *
 * When mounted, this hook takes a snapshot of the instance and stores it in a ref
 * When the instance changes, this hook will compare the current instance to the snapshot
 * and set the dirty state accordingly
 * You can also manually reset the dirty state by calling resetDirtyState, which will cause
 * another snapshot to be taken on the next render that the instance is updated
 *
 * @param instanceId the instance to track
 * @returns dirty state and a function to reset the dirty state
 */
export function useDirtyPlaygroundInstance(instanceId: number) {
  const dirtyRef = useRef<null | Partial<PlaygroundInstance>>(null);
  const [dirty, setDirty] = useState(false);
  const store = usePlaygroundStore();
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === instanceId)
  );

  const resetDirtyState = useCallback(() => {
    dirtyRef.current = null;
    setDirty(false);
  }, []);

  const debounceDirtyCheck = useMemo(
    () =>
      // eslint-disable-next-line react-compiler/react-compiler
      debounce((ref: typeof dirtyRef.current) => {
        if (!ref) {
          return false;
        }
        const state = store.getState();
        const instance = state.instances.find(
          (instance) => instance.id === instanceId
        );
        if (!instance) {
          return false;
        }
        const observedKeys: (keyof PlaygroundInstance)[] = [
          "model",
          "tools",
          "toolChoice",
          "template",
        ] as const;
        let original = pick(dirtyRef.current, observedKeys);
        let current = pick(instance, observedKeys);

        // Remove transient fields to avoid unnecessary diffs
        if (original.model) {
          original = {
            ...original,
            model: {
              ...original.model,
              supportedInvocationParameters: [],
              invocationParameters: [],
            },
          };
        }
        if (current.model) {
          current = {
            ...current,
            model: {
              ...current.model,
              supportedInvocationParameters: [],
              invocationParameters: [],
            },
          };
        }
        const isDirty = JSON.stringify(original) !== JSON.stringify(current);
        // TODO(apowell): Track dirty parts of the instance, generate diffs, etc
        setDirty(isDirty);
      }, 1000),
    [store, instanceId]
  );

  useEffect(() => {
    if (!instance) {
      dirtyRef.current = null;
      return;
    }
    if (!dirtyRef.current) {
      dirtyRef.current = instance;
    }
    debounceDirtyCheck(dirtyRef.current);
  }, [instance, debounceDirtyCheck]);

  return { dirty, resetDirtyState };
}
