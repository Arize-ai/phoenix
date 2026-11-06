import { useState, useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

/**
 * A drop-in replacement for useState that persists the value to localStorage.
 * Each key gets its own entry so different components/instances can persist independently.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setState: Dispatch<SetStateAction<T>> = useCallback(
    (valueOrUpdater) => {
      setStateInternal((prev) => {
        const next =
          typeof valueOrUpdater === "function"
            ? (valueOrUpdater as (prev: T) => T)(prev)
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
