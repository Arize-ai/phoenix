import debounce from "lodash/debounce";
import { startTransition, useMemo } from "react";

export interface UseDebouncedChangeParams<T> {
  /**
   * The change to deliver once editing pauses. Keep this reference stable — a
   * new function on every render rebuilds the debouncer and abandons whatever
   * call was pending.
   */
  onChange: (value: T) => void;
  /**
   * How long editing has to pause before the change is delivered.
   */
  debounceMs: number;
}

/**
 * A control's change policy for values that are expensive to act on: hold the
 * caller's `onChange` until editing pauses, then deliver it inside a transition
 * so the render it triggers cannot block further input. The search fields use
 * it to keep typing responsive while a query filters a large list.
 *
 * Memoized so the debouncer survives re-renders — a fresh one per render would
 * abandon the pending call rather than replacing it.
 */
export function useDebouncedChange<T = string>({
  onChange,
  debounceMs,
}: UseDebouncedChangeParams<T>) {
  return useMemo(
    () =>
      debounce((value: T) => {
        startTransition(() => {
          onChange(value);
        });
      }, debounceMs),
    [onChange, debounceMs]
  );
}
