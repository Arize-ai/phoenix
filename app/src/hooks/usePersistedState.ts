import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

/**
 * A drop-in replacement for useState that persists the value to localStorage.
 * Each key gets its own entry so different components/instances can persist independently.
 */
export function usePersistedState<StateValue>(
  key: string,
  defaultValue: StateValue
): [StateValue, Dispatch<SetStateAction<StateValue>>] {
  const [state, setStateInternal] = useState<StateValue>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as StateValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setState: Dispatch<SetStateAction<StateValue>> = useCallback(
    (valueOrUpdater) => {
      setStateInternal((prev) => {
        const next =
          typeof valueOrUpdater === "function"
            ? (valueOrUpdater as (prev: StateValue) => StateValue)(prev)
            : valueOrUpdater;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable — degrade silently
        }
        return next;
      });
    },
    [key]
  );

  return [state, setState];
}
