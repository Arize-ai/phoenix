import debounce from "lodash/debounce";
import { startTransition, useMemo } from "react";

/**
 * The search fields' shared change policy: hold the caller's `onChange` until
 * typing pauses, then deliver it inside a transition so the filtered render it
 * triggers cannot block further keystrokes.
 *
 * Memoized so the debouncer survives re-renders — a fresh one per render would
 * abandon the pending call rather than replacing it.
 */
export function useDebouncedChange(
  onChange: (value: string) => void,
  debounceMs: number
) {
  return useMemo(
    () =>
      debounce((value: string) => {
        startTransition(() => {
          onChange(value);
        });
      }, debounceMs),
    [onChange, debounceMs]
  );
}
