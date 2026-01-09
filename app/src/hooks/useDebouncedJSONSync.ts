import { useMemo } from "react";
import { debounce } from "lodash";

const DEFAULT_DEBOUNCE_DELAY = 500;

/**
 * A hook that returns a debounced function for parsing and syncing JSON strings.
 *
 * This is useful for JSON editors where you want to sync the parsed value
 * to a parent component or store, but only after the user has stopped typing.
 *
 * @param onSync - Callback that receives the parsed JSON value. Ensure this is a stable function reference!
 * @param delay - Debounce delay in milliseconds (default: 500)
 * @returns A debounced function that parses JSON and calls onSync on success
 *
 * @example
 * ```tsx
 * // this will only be called with valid json, after the 500ms debounce delay
 * const stableOnSync = useCallback((value: JSONValue) => {
 *   store.setValue(value);
 * }, [store]);
 * const syncToStore = useDebouncedJSONSync(stableOnSync, 500);
 *
 * return <JSONEditor onChange={syncToStore} />;
 * ```
 */
export function useDebouncedJSONSync<T>(
  onSync: (value: T) => void,
  delay: number = DEFAULT_DEBOUNCE_DELAY
): (jsonString: string) => void {
  const debouncedSync = useMemo(() => {
    return debounce((jsonString: string) => {
      try {
        const parsed = JSON.parse(jsonString) as T;
        onSync(parsed);
      } catch {
        // Invalid JSON is silently ignored - previous value is maintained
      }
    }, delay);
  }, [onSync, delay]);
  return debouncedSync;
}
