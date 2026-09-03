import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

/**
 * Backs a free-text filter with a URL search param so the filter is
 * shareable, survives reloads, and lets a route loader preload
 * already-filtered data.
 *
 * Returns a `[value, setValue]` tuple. The value is the param's current
 * value, or "" when absent. The setter persists the trimmed value with
 * replace-history (so typing does not spam history) while preserving
 * unrelated params. An empty or whitespace-only value removes the param:
 * absent already means unfiltered — there is no default to distinguish a
 * deliberate clear from.
 *
 * Unlike react-router's own `setSearchParams` — which is recreated whenever
 * `location.search` changes, including this hook's own writes — the returned
 * setter is reference-stable across URL changes. Consumers hand it to
 * debounced controls (see `useDebouncedChange`) that rebuild on
 * identity change, abandoning the pending call mid-typing; the latest router
 * setter is kept behind a ref so the returned setter's identity survives.
 *
 * @param paramName - the search param that carries the filter
 */
export function useFilterSearchParam(
  paramName: string
): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const value = searchParams.get(paramName) ?? "";
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);
  const setValue = useCallback(
    (nextValue: string) => {
      const trimmedValue = nextValue.trim();
      setSearchParamsRef.current(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmedValue) {
            next.set(paramName, trimmedValue);
          } else {
            next.delete(paramName);
          }
          return next;
        },
        { replace: true }
      );
    },
    [paramName]
  );
  return [value, setValue];
}
